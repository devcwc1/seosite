import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentSession, pendingMfaStep } from "@/lib/auth/session";

/**
 * Authoritative guard for every route in the (protected) group. Runs on the
 * server on each request: no session -> /login; MFA still pending -> the MFA
 * step; otherwise render the authenticated admin shell.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  const step = pendingMfaStep(current.user, current.session.mfaVerified);
  if (step) redirect(step);

  return <AdminShell user={current.user}>{children}</AdminShell>;
}
