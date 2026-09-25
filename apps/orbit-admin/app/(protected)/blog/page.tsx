import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { listPosts } from "@/lib/blog/mutations";

export default async function BlogPage() {
  const session = await getCurrentSession();
  const canWrite = !!session && isWriter(session.user);
  const rows = await listPosts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "post" : "posts"}
          </p>
        </div>
        {canWrite ? (
          <Link href="/blog/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            New post
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No posts yet</p>
          {canWrite ? (
            <Link href="/blog/new" className={buttonVariants({ variant: "outline" })}>
              Write your first post
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
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((post) => (
                <tr key={post.id} className="border-t">
                  <td className="px-4 py-2">
                    {canWrite ? (
                      <Link href={`/blog/${post.id}/edit`} className="font-medium hover:underline">
                        {post.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{post.title}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">/blog/{post.slug}</span>
                  </td>
                  <td className="px-4 py-2">
                    <StatusChip domain="post" value={post.status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {post.publishedAt ? post.publishedAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {post.updatedAt.toLocaleDateString()}
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
