import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { sessions, users, type Session, type User } from "@/lib/db/schema";

export const SESSION_COOKIE = "orbit_session";

/** Session lifetime: 7 days. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * The cookie holds a high-entropy opaque token; the database only ever stores
 * its SHA-256 hash as the primary key. A stolen DB row therefore can't be
 * replayed as a session cookie.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionWithUser = { session: Session; user: User };

/** Create a session row and return the raw cookie token + expiry. */
export async function createSession(
  userId: string,
  init: { mfaVerified?: boolean } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const hdrs = await headers();

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    mfaVerified: init.mfaVerified ?? false,
    ipAddress:
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null,
    userAgent: hdrs.get("user-agent") ?? null,
    expiresAt,
  });

  return { token, expiresAt };
}

/** Write the session cookie (httpOnly, lax, secure in production). */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Resolve the current session + user from the cookie, or null. */
export async function getCurrentSession(): Promise<SessionWithUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** Mark the current session as having cleared MFA. */
export async function markCurrentSessionMfaVerified(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await db
    .update(sessions)
    .set({ mfaVerified: true })
    .where(eq(sessions.id, hashToken(token)));
}

/** Delete the current session (sign-out) and clear its cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
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
