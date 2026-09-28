"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  pendingMfaStep,
  setSessionCookie,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Same generic message whether the email is unknown or the password is wrong.
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return { error: "Invalid email or password." };
  }

  const { token, cookieExpiresAt } = await createSession(user.id);
  await setSessionCookie(token, cookieExpiresAt);
  await recordAudit({
    actorId: user.id,
    action: "auth.login",
    target: `user:${user.id}`,
  });

  // redirect() throws; keep it out of any try/catch.
  redirect(pendingMfaStep(user, false) ?? "/dashboard");
}
