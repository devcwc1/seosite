import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

import {
  sessionsCollection,
  usersCollection,
  type SessionDoc,
  type UserDoc,
} from "@/lib/db/mongo-collections";
import type { Session, User } from "@/lib/db/schema";

export const SESSION_COOKIE = "orbit_session";

/**
 * The app has always worked in terms of `id`; the documents use `_id`. These
 * mappers bridge the two so every caller of `getCurrentSession` et al. keeps
 * the same `User`/`Session` shape it had under Postgres.
 */
function toUser(doc: UserDoc): User {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}
function toSession(doc: SessionDoc): Session {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/**
 * Two clocks (ORB-203). The idle clock slides forward on activity so an active
 * session stays alive; the absolute clock is fixed at creation and never moves,
 * so even a continuously-used session must re-authenticate after 7 days.
 */
const IDLE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Don't write a new idle expiry on every single request. Bumping only once the
 * idle clock has advanced by at least this much keeps an active session to
 * roughly one small UPDATE per minute instead of one per request.
 */
const SLIDE_THROTTLE_MS = 1000 * 60; // 1 minute

/**
 * The cookie holds a high-entropy opaque token; the database only ever stores
 * its SHA-256 hash as the primary key. A stolen DB row therefore can't be
 * replayed as a session cookie, and the lookup is an indexed equality on the
 * hash — no raw-token comparison happens in application code, so there is no
 * timing side channel to exploit.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionWithUser = { session: Session; user: User };

/** Create a session row and return the raw cookie token + its cookie lifetime. */
export async function createSession(
  userId: string,
  init: { mfaVerified?: boolean } = {},
): Promise<{ token: string; cookieExpiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const absoluteExpiresAt = new Date(now + ABSOLUTE_TTL_MS);
  const expiresAt = new Date(now + IDLE_TTL_MS);

  const hdrs = await headers();

  await sessionsCollection().insertOne({
    _id: hashToken(token),
    userId,
    mfaVerified: init.mfaVerified ?? false,
    ipAddress:
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null,
    userAgent: hdrs.get("user-agent") ?? null,
    expiresAt,
    absoluteExpiresAt,
    revokedAt: null,
    createdAt: new Date(),
  });

  // The browser keeps the cookie until the absolute cap; the idle timeout is
  // enforced server-side, so we never have to re-set the cookie on activity.
  return { token, cookieExpiresAt: absoluteExpiresAt };
}

/**
 * The cookie's attributes, in one place so the security test can assert them
 * without a request context. HttpOnly and SameSite=Lax are unconditional;
 * Secure is on in production (localhost is plain HTTP in development, where a
 * Secure cookie would never be sent back).
 */
export function sessionCookieOptions(
  expiresAt: Date,
): Omit<ResponseCookie, "name" | "value"> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

/** Write the session cookie (httpOnly, lax, secure in production). */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Validate a raw session token against the database — the whole authentication
 * decision, on every request. Returns the session + user only if all four
 * conditions hold, and slides the idle clock forward as a side effect. Kept free
 * of the cookie/header machinery so it can be exercised directly by tests.
 *
 * A session is valid when it: exists (indexed hash lookup), has not been revoked
 * (`revoked_at IS NULL`), is within both the idle and the absolute expiry, and
 * belongs to an account that is still `active`. A disabled account therefore
 * loses access on its very next request, without waiting for any expiry.
 */
export async function validateSessionToken(
  token: string,
): Promise<SessionWithUser | null> {
  // Two reads rather than a SQL join: the session by its hashed id (and not
  // revoked), then the account it belongs to. Both are indexed equality lookups.
  const sessionDoc = await sessionsCollection().findOne({
    _id: hashToken(token),
    revokedAt: null,
  });
  if (!sessionDoc) return null;

  const userDoc = await usersCollection().findOne({ _id: sessionDoc.userId });
  if (!userDoc) return null;

  const now = Date.now();

  if (now >= sessionDoc.absoluteExpiresAt.getTime()) return null; // absolute cap
  if (now >= sessionDoc.expiresAt.getTime()) return null; // idle timeout
  if (userDoc.status !== "active") return null; // disabled mid-session

  const session = toSession(sessionDoc);
  const user = toUser(userDoc);

  // Slide the idle clock forward, never past the absolute cap. Throttled so an
  // active session is not one write per request.
  const nextExpiry = new Date(
    Math.min(now + IDLE_TTL_MS, sessionDoc.absoluteExpiresAt.getTime()),
  );
  if (nextExpiry.getTime() - sessionDoc.expiresAt.getTime() >= SLIDE_THROTTLE_MS) {
    await sessionsCollection().updateOne(
      { _id: sessionDoc._id },
      { $set: { expiresAt: nextExpiry } },
    );
    session.expiresAt = nextExpiry;
  }

  return { session, user };
}

/** Resolve the current session + user from the cookie, or null. */
export async function getCurrentSession(): Promise<SessionWithUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** Mark the current session as having cleared MFA. */
export async function markCurrentSessionMfaVerified(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await sessionsCollection().updateOne(
    { _id: hashToken(token) },
    { $set: { mfaVerified: true } },
  );
}

/**
 * Revoke every live session for a user (ORB-203). Called when the account is
 * disabled, the password changes, or MFA is reset — anything that should end
 * all existing sessions at once. Setting `revoked_at` is authoritative: the next
 * request on any of those cookies fails validation. Already-revoked rows are
 * left untouched so their original revocation time survives.
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  await sessionsCollection().updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/**
 * Sign out: revoke the current session server-side and clear its cookie.
 * Authoritative (the row is marked revoked, not merely un-cookied) and
 * idempotent — safe to call with no cookie or an already-revoked session.
 */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await sessionsCollection().updateOne(
      { _id: hashToken(token), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
  store.delete(SESSION_COOKIE);
}

/**
 * The MFA step a user still owes before reaching the protected area, or null if
 * fully authenticated. Real TOTP enrolment/verification is stubbed for now, but
 * the gate itself is enforced.
 */
export function pendingMfaStep(
  user: Pick<User, "mfaEnforced" | "mfaEnrolled">,
  mfaVerified: boolean,
): "/mfa/enroll" | "/mfa" | null {
  if (user.mfaEnforced && !user.mfaEnrolled) return "/mfa/enroll";
  if (user.mfaEnforced && !mfaVerified) return "/mfa";
  return null;
}

/** Whether a user holds the admin role (may manage other users). */
export function isAdmin(user: Pick<User, "role">): boolean {
  return user.role === "admin";
}

/**
 * Whether a user may change content — products, galleries, media. Viewers are
 * read-only; admins and editors both write. Every content mutation asks this
 * one question, so the rule lives here rather than in each action.
 */
export function isWriter(user: Pick<User, "role">): boolean {
  return user.role !== "viewer";
}

/** Current session if the user is an admin, otherwise null. */
export async function requireAdminSession(): Promise<SessionWithUser | null> {
  const current = await getCurrentSession();
  return current && isAdmin(current.user) ? current : null;
}
