import { randomBytes } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db, pool } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { updateUser } from "@/lib/users/mutations";
import { updateUserSchema } from "@/lib/users/validation";

import {
  hashToken,
  revokeUserSessions,
  sessionCookieOptions,
  validateSessionToken,
} from "./session";

/**
 * ORB-203 security behaviour, against a real Postgres. The parts a mock would
 * get wrong: expiry maths across two clocks, revocation, and disabled-account
 * rejection are all decided by the database row, so they are tested there.
 *
 * Sessions are inserted directly with a known raw token (hashed to the primary
 * key), which lets `validateSessionToken` be exercised without a request's
 * cookie jar.
 */

const HOUR = 1000 * 60 * 60;
const suffix = Date.now().toString(36);
const createdUserIds: string[] = [];

async function makeUser(
  over: Partial<{ role: "admin" | "editor" | "viewer"; status: "active" | "disabled"; email: string }> = {},
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      email: over.email ?? `sec-${suffix}-${createdUserIds.length}@example.test`,
      passwordHash: "not-a-real-hash",
      role: over.role ?? "editor",
      status: over.status ?? "active",
    })
    .returning({ id: users.id });
  createdUserIds.push(row!.id);
  return row!.id;
}

async function makeSession(
  userId: string,
  over: { idleMs?: number; absoluteMs?: number; revoked?: boolean } = {},
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    mfaVerified: true,
    expiresAt: new Date(now + (over.idleMs ?? 12 * HOUR)),
    absoluteExpiresAt: new Date(now + (over.absoluteMs ?? 7 * 24 * HOUR)),
    revokedAt: over.revoked ? new Date() : null,
  });
  return token;
}

function updateInput(over: Record<string, unknown> = {}) {
  return updateUserSchema.parse({
    email: `sec-${suffix}-upd-${Math.random().toString(36).slice(2, 8)}@example.test`,
    password: "",
    role: "editor",
    mfaEnforced: false,
    resetMfaEnrollment: false,
    status: "active",
    ...over,
  });
}

afterAll(async () => {
  if (createdUserIds.length) {
    // Sessions cascade via their FK to users.id.
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await pool.end();
});

describe("session validation (ORB-203)", () => {
  it("accepts a live, unexpired session", async () => {
    const userId = await makeUser();
    const token = await makeSession(userId);

    const result = await validateSessionToken(token);
    expect(result?.user.id).toBe(userId);
  });

  it("rejects an unknown token", async () => {
    expect(await validateSessionToken("nonexistent-token")).toBeNull();
  });

  it("rejects a replayed cookie after the session is revoked (logout)", async () => {
    const userId = await makeUser();
    const token = await makeSession(userId);
    expect(await validateSessionToken(token)).not.toBeNull();

    // Same revocation path logout and bulk-revoke use: set revoked_at.
    await revokeUserSessions(userId);

    expect(await validateSessionToken(token)).toBeNull();
  });

  it("rejects the next request once the account is disabled mid-session", async () => {
    const userId = await makeUser();
    const token = await makeSession(userId);
    expect(await validateSessionToken(token)).not.toBeNull();

    await db.update(users).set({ status: "disabled" }).where(eq(users.id, userId));

    // Not revoked, not expired — rejected purely because the user is disabled.
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("rejects a session past its idle timeout", async () => {
    const userId = await makeUser();
    // Idle clock already elapsed, absolute clock still far off.
    const token = await makeSession(userId, { idleMs: -HOUR, absoluteMs: 24 * HOUR });

    expect(await validateSessionToken(token)).toBeNull();
  });

  it("rejects a session past its absolute cap even if recently active", async () => {
    const userId = await makeUser();
    // Idle clock fresh, absolute cap already passed.
    const token = await makeSession(userId, { idleMs: HOUR, absoluteMs: -1 });

    expect(await validateSessionToken(token)).toBeNull();
  });

  it("slides the idle clock forward on a valid request, capped at the absolute expiry", async () => {
    const userId = await makeUser();
    // Idle expiry only two minutes out; absolute far away, so it can slide.
    const token = await makeSession(userId, { idleMs: 2 * 60 * 1000 });
    const before = (
      await db.select().from(sessions).where(eq(sessions.id, hashToken(token))).limit(1)
    )[0]!;

    const result = await validateSessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.session.expiresAt.getTime()).toBeGreaterThan(
      before.expiresAt.getTime(),
    );
    // Never past the absolute cap.
    expect(result!.session.expiresAt.getTime()).toBeLessThanOrEqual(
      before.absoluteExpiresAt.getTime(),
    );

    const after = (
      await db.select().from(sessions).where(eq(sessions.id, hashToken(token))).limit(1)
    )[0]!;
    expect(after.expiresAt.getTime()).toBe(result!.session.expiresAt.getTime());
  });
});

describe("session cookie attributes (ORB-203)", () => {
  it("is HttpOnly, SameSite=Lax and host-scoped", () => {
    const opts = sessionCookieOptions(new Date("2030-01-01T00:00:00Z"));
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    // Host-scoped: no domain attribute, so the cookie is not sent to subdomains.
    expect(opts.domain).toBeUndefined();
  });

  it("is Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(sessionCookieOptions(new Date()).secure).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("bulk revocation triggers (ORB-203)", () => {
  it("revokes every live session when the password changes", async () => {
    const userId = await makeUser();
    const a = await makeSession(userId);
    const b = await makeSession(userId);

    const result = await updateUser(
      userId,
      updateInput({ password: "a-brand-new-password" }),
      null,
    );
    expect(result.ok).toBe(true);

    expect(await validateSessionToken(a)).toBeNull();
    expect(await validateSessionToken(b)).toBeNull();
  });

  it("disables the account and revokes its sessions in one step", async () => {
    const userId = await makeUser();
    const token = await makeSession(userId);

    const result = await updateUser(userId, updateInput({ status: "disabled" }), null);
    expect(result.ok).toBe(true);

    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(row?.status).toBe("disabled");
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("refuses to let an admin disable their own account", async () => {
    const adminId = await makeUser({ role: "admin" });

    const result = await updateUser(
      adminId,
      updateInput({ role: "admin", status: "disabled" }),
      adminId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.status).toBeTruthy();
  });
});
