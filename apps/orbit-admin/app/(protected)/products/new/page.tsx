import { redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/mutations";

export default async function NewProductPage() {
  // A viewer has no route here, so send them back rather than render a form
  // whose submit the server would refuse.
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect("/products");

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
