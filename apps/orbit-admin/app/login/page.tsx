import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession, pendingMfaStep } from "@/lib/auth/session";

export default async function LoginPage() {
  // Already signed in? Skip the form and continue the auth flow.
  const current = await getCurrentSession();
  if (current) {
    redirect(pendingMfaStep(current.user, current.session.mfaVerified) ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <LoginForm />
    </div>
  );
}
