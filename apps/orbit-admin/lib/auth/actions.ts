"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import {
  destroyCurrentSession,
  getCurrentSession,
  markCurrentSessionMfaVerified,
} from "@/lib/auth/session";
import { usersCollection } from "@/lib/db/mongo-collections";

/** Sign out: delete the session row, clear the cookie, back to /login. */
export async function logoutAction(): Promise<void> {
  const current = await getCurrentSession();
  if (current) {
    await recordAudit({
      actorId: current.user.id,
      action: "auth.logout",
      target: `user:${current.user.id}`,
    });
  }
  await destroyCurrentSession();
  redirect("/login");
}

/**
 * DEV PLACEHOLDER for MFA enrolment. Real TOTP enrolment (secret + QR + verify)
 * lands in a later task; for now this marks the user enrolled and the session
 * MFA-verified so the enforced-MFA gate can be exercised end to end.
 */
export async function completeMfaEnrollmentAction(): Promise<void> {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  await usersCollection().updateOne(
    { _id: current.user.id },
    { $set: { mfaEnrolled: true } },
  );
  await markCurrentSessionMfaVerified();
  await recordAudit({
    actorId: current.user.id,
    action: "auth.mfa_enrolled",
    target: `user:${current.user.id}`,
    metadata: { placeholder: true },
  });

  redirect("/dashboard");
}

/** DEV PLACEHOLDER for MFA verification (see completeMfaEnrollmentAction). */
export async function verifyMfaAction(): Promise<void> {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  await markCurrentSessionMfaVerified();
  await recordAudit({
    actorId: current.user.id,
    action: "auth.mfa_verified",
    target: `user:${current.user.id}`,
    metadata: { placeholder: true },
  });

  redirect("/dashboard");
}
