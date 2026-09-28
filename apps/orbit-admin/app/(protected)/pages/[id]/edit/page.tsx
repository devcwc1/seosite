import { notFound, redirect } from "next/navigation";

import { PageForm } from "@/components/pages/page-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { getPageForEdit } from "@/lib/pages/mutations";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect("/pages");

  const page = await getPageForEdit(id);
  if (!page) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit page</h1>
        <p className="text-sm text-muted-foreground">/{page.slug}</p>
      </div>
      <PageForm mode="edit" initial={page} />
    </div>
  );
}
