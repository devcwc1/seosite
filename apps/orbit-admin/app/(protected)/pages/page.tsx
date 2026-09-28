import Link from "next/link";
import { Files, Plus } from "lucide-react";

import { DeletePageButton } from "@/components/pages/delete-page-button";
import { StatusChip } from "@/components/ui/status-chip";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { listPages } from "@/lib/pages/mutations";

export default async function PagesPage() {
  const session = await getCurrentSession();
  const canWrite = !!session && isWriter(session.user);
  const rows = await listPages();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "page" : "pages"}
          </p>
        </div>
        {canWrite ? (
          <Link href="/pages/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            New page
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <Files className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No pages yet</p>
          {canWrite ? (
            <Link href="/pages/new" className={buttonVariants({ variant: "outline" })}>
              Create your first page
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Updated</th>
                <th className="w-0 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((page) => (
                <tr key={page.id} className="border-t">
                  <td className="px-4 py-2">
                    {canWrite ? (
                      <Link href={`/pages/${page.id}/edit`} className="font-medium hover:underline">
                        {page.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{page.title}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">/{page.slug}</span>
                  </td>
                  <td className="px-4 py-2">
                    <StatusChip domain="page" value={page.status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {page.updatedAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canWrite ? <DeletePageButton id={page.id} title={page.title} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
