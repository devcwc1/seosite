import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="text-sm text-muted-foreground">
          Add a new product to the catalog.
        </p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
