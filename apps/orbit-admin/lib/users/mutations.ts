import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

import type {
  CreateUserParsed,
  UpdateUserParsed,
  UserAccountStatus,
  UserRole,
} from "./validation";

export type UserMutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

export type UserListItem = {
  id: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  mfaEnforced: boolean;
  mfaEnrolled: boolean;
  createdAt: string;
};

export type UserEditData = {
  id: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  mfaEnforced: boolean;
  mfaEnrolled: boolean;
};

/**
 * Admins who can actually sign in. A disabled admin cannot rescue a locked-out
 * system, so it must not count toward the "at least one admin" guarantee.
 */
async function countActiveAdmins(): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));
  return rows[0]?.value ?? 0;
}

export async function listUsers(): Promise<UserListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      mfaEnforced: users.mfaEnforced,
      mfaEnrolled: users.mfaEnrolled,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getUserForEdit(id: string): Promise<UserEditData | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    mfaEnforced: u.mfaEnforced,
    mfaEnrolled: u.mfaEnrolled,
  };
}

export async function createUser(
  input: CreateUserParsed,
  actorId: string | null,
): Promise<UserMutationResult> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing) return { ok: false, errors: { email: "Email already in use." } };

  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      role: input.role,
      mfaEnforced: input.mfaEnforced,
      mfaEnrolled: false,
    })
    .returning({ id: users.id });
  if (!row) throw new Error("Failed to insert user");

  await recordAudit({
    actorId,
    action: "user.created",
    target: `user:${row.id}`,
    metadata: { email: input.email, role: input.role },
  });

  return { ok: true, id: row.id };
}

export async function updateUser(
  id: string,
  input: UpdateUserParsed,
  actorId: string | null,
): Promise<UserMutationResult> {
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return { ok: false, errors: { form: "User not found." } };

  if (input.email !== target.email) {
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (dup) return { ok: false, errors: { email: "Email already in use." } };
  }

  // Locking yourself out is almost always a mistake and leaves no clean way
  // back in, so it is refused outright.
  if (id === actorId && input.status === "disabled") {
    return { ok: false, errors: { status: "You can't disable your own account." } };
  }

  // Never leave the system without an admin who can actually sign in. Both
  // demoting the last active admin and disabling them are blocked here.
  const wasActiveAdmin = target.role === "admin" && target.status === "active";
  const willBeActiveAdmin = input.role === "admin" && input.status === "active";
  if (wasActiveAdmin && !willBeActiveAdmin && (await countActiveAdmins()) <= 1) {
    return {
      ok: false,
      errors: { form: "There must be at least one active admin." },
    };
  }

  const set: {
    email: string;
    role: UserRole;
    status: UserAccountStatus;
    mfaEnforced: boolean;
    mfaEnrolled?: boolean;
    passwordHash?: string;
  } = {
    email: input.email,
    role: input.role,
    status: input.status,
    mfaEnforced: input.mfaEnforced,
  };
  if (input.resetMfaEnrollment) set.mfaEnrolled = false;
  const passwordChanged = input.password.length > 0;
  if (passwordChanged) set.passwordHash = await hashPassword(input.password);

  await db.update(users).set(set).where(eq(users.id, id));

  // Anything that should end the user's current access revokes every live
  // session at once: a new password, a forced MFA re-enrol, or being disabled.
  const disabling = input.status === "disabled" && target.status === "active";
  if (passwordChanged || input.resetMfaEnrollment || disabling) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
  }

  await recordAudit({
    actorId,
    action: "user.updated",
    target: `user:${id}`,
    metadata: {
      email: input.email,
      role: input.role,
      status: input.status,
      passwordChanged,
      mfaReset: input.resetMfaEnrollment,
      disabled: disabling,
    },
  });

  return { ok: true, id };
}

export async function deleteUser(
  id: string,
  actorId: string | null,
): Promise<UserMutationResult> {
  if (id === actorId) {
    return { ok: false, errors: { form: "You can't delete your own account." } };
  }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return { ok: false, errors: { form: "User not found." } };

  if (target.role === "admin" && (await countActiveAdmins()) <= 1) {
    return { ok: false, errors: { form: "Can't delete the last admin." } };
  }

  // Sessions cascade via their FK to users.id.
  await db.delete(users).where(eq(users.id, id));

  await recordAudit({
    actorId,
    action: "user.deleted",
    target: `user:${id}`,
    metadata: { email: target.email },
  });

  return { ok: true, id };
}
