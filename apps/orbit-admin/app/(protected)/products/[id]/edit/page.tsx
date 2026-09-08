import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
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

  const product = await getProductForEdit(id);
  if (!product) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
        <p className="text-sm text-muted-foreground">{product.title}</p>
      </div>
      <ProductForm
        mode="edit"
        initial={{
          ...product,
          reviews: product.reviews.map((r) => ({
            id: r.id,
            author: r.author,
            rating: r.rating,
            title: r.title ?? "",
            body: r.body,
            createdAt: r.createdAt,
          })),
        }}
      />
    </div>
  );
}
