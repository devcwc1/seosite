import { CategoryForm } from "@/components/categories/category-form";

export default function NewCategoryPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New category</h1>
        <p className="text-sm text-muted-foreground">
          Creates an archive page on the storefront at its slug.
        </p>
      </div>
      <CategoryForm mode="create" />
    </div>
  );
}
