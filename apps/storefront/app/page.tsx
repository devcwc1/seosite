import type { StorefrontProduct } from "@orbit/next";

import { ProductCard } from "@/components/product-card";
import { orbit } from "@/lib/orbit";

export const metadata = {
  title: "Catalog",
};

/** Shared page-header band: tonal surface, wide margins, no invented claims. */
function CatalogHeader({ subtitle }: { subtitle: string }) {
  return (
    <section className="bg-surface py-xl">
      <div className="shell max-w-3xl">
        <p className="mb-sm text-label-md text-primary uppercase">Catalog</p>
        <h1 className="mb-sm text-headline-lg text-balance text-on-surface sm:text-display-lg">
          Everything published, in one place.
        </h1>
        <p className="text-body-lg text-on-surface-variant">{subtitle}</p>
      </div>
    </section>
  );
}

export default async function CatalogPage() {
  let products: StorefrontProduct[];

  try {
    products = await orbit.listProducts();
  } catch {
    // The content API is not reachable (not yet deployed, or briefly down).
    // Degrade to an empty catalog; the SDK's revalidation window retries.
    return (
      <>
        <CatalogHeader subtitle="The catalog is temporarily unavailable." />
        <div className="shell py-xl">
          <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
            We could not reach the catalog just now. It comes back on its own —
            please try again in a moment.
          </p>
        </div>
      </>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <CatalogHeader subtitle="No products are published yet." />
        <div className="shell py-xl">
          <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
            Once a product is published in Orbit, it appears here.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <CatalogHeader
        subtitle={`${products.length} ${
          products.length === 1 ? "product" : "products"
        } available to order.`}
      />

      <section className="bg-surface-container-low py-xl">
        <div className="shell">
          <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
