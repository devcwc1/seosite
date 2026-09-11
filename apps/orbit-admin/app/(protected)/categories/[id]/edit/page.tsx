import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/categories/category-form";
import { getCategory } from "@/lib/categories/mutations";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit category</h1>
        <p className="text-sm text-muted-foreground">
          /categories/{category.slug}
        </p>
      </div>
      <CategoryForm
        mode="edit"
        initial={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          position: category.position,
          meta: category.meta,
        }}
      />
    </div>
  );
}
