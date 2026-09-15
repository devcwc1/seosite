import { forbidden, notFound } from "next/navigation";

import { UserForm } from "@/components/users/user-form";
import { getCurrentSession, isAdmin } from "@/lib/auth/session";
import { getUserForEdit } from "@/lib/users/mutations";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  // 403, not a redirect: the reader is authenticated and the page exists,
  // they simply hold the wrong role, and a probe should be able to tell
  // those apart. UI hiding is courtesy; this is the control (FR-SEC-006).
  if (!session || !isAdmin(session.user)) forbidden();

  const { id } = await params;
  const user = await getUserForEdit(id);
  if (!user) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit user</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <UserForm mode="edit" initial={user} />
    </div>
  );
}
