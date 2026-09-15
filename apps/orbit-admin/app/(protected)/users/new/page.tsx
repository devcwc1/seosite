import { forbidden } from "next/navigation";

import { UserForm } from "@/components/users/user-form";
import { getCurrentSession, isAdmin } from "@/lib/auth/session";

export default async function NewUserPage() {
  const session = await getCurrentSession();
  // 403, not a redirect: the reader is authenticated and the page exists,
  // they simply hold the wrong role, and a probe should be able to tell
  // those apart. UI hiding is courtesy; this is the control (FR-SEC-006).
  if (!session || !isAdmin(session.user)) forbidden();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New user</h1>
        <p className="text-sm text-muted-foreground">
          Create an account that can sign in to the admin.
        </p>
      </div>
      <UserForm mode="create" />
    </div>
  );
}
