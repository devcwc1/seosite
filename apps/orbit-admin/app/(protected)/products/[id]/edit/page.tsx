import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/mutations";
import { getProductForEdit } from "@/lib/products/mutations";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A viewer can read the product, just not this form.
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) redirect(`/products/${id}`);

  const [product, categories] = await Promise.all([
    getProductForEdit(id),
    listCategories(),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
        <p className="text-sm text-muted-foreground">{product.title}</p>
      </div>
      <ProductForm
        mode="edit"
        availableCategories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
        }))}
        initial={{
          ...product,
          reviews: product.reviews.map((review) => ({
            id: review.id,
            author: review.author,
            rating: review.rating,
            title: review.title ?? "",
            body: review.body,
            createdAt: review.createdAt,
          })),
        }}
      />
    </div>
  );
}
