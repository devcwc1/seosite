import { redirect } from "next/navigation";

import { PostForm } from "@/components/blog/post-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";

export default async function NewPostPage() {
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect("/blog");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
        <p className="text-sm text-muted-foreground">Write a blog article.</p>
      </div>
      <PostForm mode="create" />
    </div>
  );
}
