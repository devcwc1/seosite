import type { Metadata } from "next";
import Link from "next/link";
import type { StorefrontProduct } from "@orbit/next";

import { ProductCard } from "@/components/product-card";
import { orbit, matchesQuery } from "@/lib/orbit";
import { getSite, pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const site = await getSite();

  return pageMetadata(site, {
    path: "/products",
    title: "Catalog",
    description: `Every product in ${site.siteName}.`,
    // A search results page is a different page for every query, and none of
    // them is something to send a searcher to.
    noindex: Boolean(q?.trim()),
  });
}

type CatalogPageProps = {
  // Category browsing lives at /categories/[slug] — its own indexable page —
  // so this route only ever filters by free text.
  searchParams: Promise<{ q?: string }>;
};

/** Page-header band: tonal surface, wide margins, no invented claims. */
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell py-xl">
      <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
        {children}
      </p>
    </div>
  );
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let products: StorefrontProduct[];

  try {
    products = await orbit.listProducts();
  } catch {
    // The content API is not reachable (not yet deployed, or briefly down).
    // Degrade to an empty catalog; the SDK's revalidation window retries.
    return (
      <>
        <CatalogHeader subtitle="The catalog is temporarily unavailable." />
        <Notice>
          We could not reach the catalog just now. It comes back on its own —
          please try again in a moment.
        </Notice>
      </>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <CatalogHeader subtitle="No products are published yet." />
        <Notice>Once a product is published in Orbit, it appears here.</Notice>
      </>
    );
  }

  // Filtering happens here rather than in the API: the catalog is small, and
  // `@orbit/next` deliberately exposes no query contract to consumers.
  const matches = products.filter((product) => matchesQuery(product, query));

  const filtered = query !== "";
  const subtitle = filtered
    ? `${matches.length} of ${products.length} ${
        products.length === 1 ? "product" : "products"
      } match.`
    : `${products.length} ${
        products.length === 1 ? "product" : "products"
      } available to order.`;

  return (
    <>
      <CatalogHeader subtitle={subtitle} />

      <section className="bg-surface-container-low py-xl">
        <div className="shell">
          {filtered ? (
            <div className="mb-md flex flex-wrap items-center gap-sm">
              <span className="pill bg-surface-container text-on-surface-variant">
                “{query}”
              </span>
              <Link
                href="/products"
                className="text-body-sm text-primary underline-offset-2 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : null}

          {matches.length === 0 ? (
            <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
              Nothing matches that. Try a different word, or{" "}
              <Link href="/products" className="text-primary hover:underline">
                browse everything
              </Link>
              .
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
              {matches.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
