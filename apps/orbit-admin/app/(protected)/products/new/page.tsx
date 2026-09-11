import { ProductForm } from "@/components/products/product-form";
import { listCategories } from "@/lib/categories/mutations";

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="text-sm text-muted-foreground">
          Add a new product to the catalog.
        </p>
      </div>
      <ProductForm
        mode="create"
        availableCategories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
        }))}
      />
    </div>
  );
}
