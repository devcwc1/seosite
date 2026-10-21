import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import {
  sessionsCollection,
  usersCollection,
} from "@/lib/db/mongo-collections";

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
  return usersCollection().countDocuments({ role: "admin", status: "active" });
}

export async function listUsers(): Promise<UserListItem[]> {
  const rows = await usersCollection()
    .find({})
    .sort({ createdAt: 1 })
    .toArray();

  return rows.map((r) => ({
    id: r._id,
    email: r.email,
    role: r.role,
    status: r.status,
    mfaEnforced: r.mfaEnforced,
    mfaEnrolled: r.mfaEnrolled,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getUserForEdit(id: string): Promise<UserEditData | null> {
  const u = await usersCollection().findOne({ _id: id });
  if (!u) return null;
  return {
    id: u._id,
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
  const existing = await usersCollection().findOne(
    { email: input.email },
    { projection: { _id: 1 } },
  );
  if (existing) return { ok: false, errors: { email: "Email already in use." } };

  const passwordHash = await hashPassword(input.password);
  const id = randomUUID();
  try {
    await usersCollection().insertOne({
      _id: id,
      email: input.email,
      passwordHash,
      role: input.role,
      status: "active",
      mfaEnforced: input.mfaEnforced,
      mfaEnrolled: false,
      createdAt: new Date(),
    });
  } catch (error) {
    // The unique email index is the authoritative guard against a race between
    // the check above and the insert.
    if ((error as { code?: number }).code === 11000) {
      return { ok: false, errors: { email: "Email already in use." } };
    }
    throw error;
  }

  await recordAudit({
    actorId,
    action: "user.created",
    target: `user:${id}`,
    metadata: { email: input.email, role: input.role },
  });

  return { ok: true, id };
}

export async function updateUser(
  id: string,
  input: UpdateUserParsed,
  actorId: string | null,
): Promise<UserMutationResult> {
  const target = await usersCollection().findOne({ _id: id });
  if (!target) return { ok: false, errors: { form: "User not found." } };

  if (input.email !== target.email) {
    const dup = await usersCollection().findOne(
      { email: input.email },
      { projection: { _id: 1 } },
    );
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

  await usersCollection().updateOne({ _id: id }, { $set: set });

  // Anything that should end the user's current access revokes every live
  // session at once: a new password, a forced MFA re-enrol, or being disabled.
  const disabling = input.status === "disabled" && target.status === "active";
  if (passwordChanged || input.resetMfaEnrollment || disabling) {
    await sessionsCollection().updateMany(
      { userId: id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
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

  const target = await usersCollection().findOne({ _id: id });
  if (!target) return { ok: false, errors: { form: "User not found." } };

  if (target.role === "admin" && (await countActiveAdmins()) <= 1) {
    return { ok: false, errors: { form: "Can't delete the last admin." } };
  }

  await usersCollection().deleteOne({ _id: id });
  // No FK cascade in MongoDB: the user's sessions are removed explicitly so a
  // deleted account leaves nothing a cookie could still resolve against.
  await sessionsCollection().deleteMany({ userId: id });

  await recordAudit({
    actorId,
    action: "user.deleted",
    target: `user:${id}`,
    metadata: { email: target.email },
  });

  return { ok: true, id };
}
