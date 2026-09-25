import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/blog/post-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { getPostForEdit } from "@/lib/blog/mutations";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect("/blog");

  const post = await getPostForEdit(id);
  if (!post) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit post</h1>
        <p className="text-sm text-muted-foreground">/blog/{post.slug}</p>
      </div>
      <PostForm mode="edit" initial={post} />
    </div>
  );
}
