import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteUserButton } from "@/components/users/delete-user-button";
import { getCurrentSession, isAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/users/mutations";

const ROLE_VARIANT = {
  admin: "default",
  editor: "secondary",
  viewer: "outline",
} as const;

export default async function UsersPage() {
  const session = await getCurrentSession();
  if (!session || !isAdmin(session.user)) redirect("/dashboard");

  const users = await listUsers();
  const currentId = session.user.id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <Link href="/users/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          New user
        </Link>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>MFA</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.email}
                  {u.id === currentId ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_VARIANT[u.role]}>{u.role}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.mfaEnforced ? "Enforced" : "Optional"} ·{" "}
                  {u.mfaEnrolled ? "enrolled" : "not enrolled"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {u.createdAt.slice(0, 10)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/users/${u.id}/edit`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Edit
                    </Link>
                    <DeleteUserButton
                      id={u.id}
                      email={u.email}
                      disabled={u.id === currentId}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
