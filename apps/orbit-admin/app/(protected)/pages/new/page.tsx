import { redirect } from "next/navigation";

import { PageForm } from "@/components/pages/page-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";

export default async function NewPagePage() {
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect("/pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New page</h1>
        <p className="text-sm text-muted-foreground">Create a content page.</p>
      </div>
      <PageForm mode="create" />
    </div>
  );
}
