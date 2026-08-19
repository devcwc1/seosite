import { redirect } from "next/navigation";

import { UserForm } from "@/components/users/user-form";
import { getCurrentSession, isAdmin } from "@/lib/auth/session";

export default async function NewUserPage() {
  const session = await getCurrentSession();
  if (!session || !isAdmin(session.user)) redirect("/dashboard");

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
