import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { StorefrontProduct } from "@orbit/next";

import { ImagePlaceholderIcon } from "@/components/icons";
import { StockBadge } from "@/components/stock-badge";
import {
  formatPrice,
  galleryImages,
  orbit,
  primaryCategory,
} from "@/lib/orbit";

/**
 * The `[id]` segment carries a product's public slug — the stable identifier
 * `@orbit/next` looks products up by (`OrbitClient.getProduct`).
 */
type ProductPageProps = {
  params: Promise<{ id: string }>;
};

async function loadProduct(id: string): Promise<StorefrontProduct | null> {
  try {
    // The SDK already maps a 404 to `null`; this guards transport failures.
    return await orbit.getProduct(id);
  } catch {
    return null;
  }
}

export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    const products = await orbit.listProducts();
    return products.map((product) => ({ id: product.slug }));
  } catch {
    // Content API unreachable at build time — fall back to on-demand rendering.
    return [];
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.title,
    description: product.shortInfo ?? undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await loadProduct(id);

  if (!product) {
    notFound();
  }

  const images = galleryImages(product);
  const [lead, ...rest] = images;
  const category = primaryCategory(product);

  return (
    <div className="bg-surface-container-low pb-xl">
      <div className="shell">
        <nav aria-label="Breadcrumb" className="py-md">
          <ol className="flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
            <li>
              <Link href="/" className="transition-colors hover:text-primary">
                Catalog
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-semibold text-on-surface">{product.title}</li>
          </ol>
        </nav>

        <article className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          {/* -- gallery ------------------------------------------------- */}
          <div className="flex flex-col gap-sm">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-card">
              {lead ? (
                /* Remote URLs from the content API bypass next/image's
                   host allow-list. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.url}
                  alt={lead.alt ?? product.title}
                  className="max-h-full object-contain"
                />
              ) : (
                <ImagePlaceholderIcon className="size-12 text-outline" />
              )}
            </div>

            {rest.length > 0 ? (
              <ul className="grid grid-cols-4 gap-sm">
                {rest.map((image) => (
                  <li
                    key={image.url}
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-DEFAULT border border-outline-variant bg-surface-container-lowest p-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.alt ?? ""}
                      className="max-h-full object-contain"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* -- detail -------------------------------------------------- */}
          <div className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-card">
            {category ? (
              <p className="mb-xs text-label-md text-on-surface-variant uppercase">
                {category.name}
              </p>
            ) : null}

            <h1 className="mb-sm text-headline-lg text-balance text-on-surface">
              {product.title}
            </h1>

            <div className="mb-md flex flex-wrap items-center gap-sm">
              <span className="text-display-lg text-primary">
                {formatPrice(product)}
              </span>
              <StockBadge inStock={product.inStock} />
            </div>

            {product.shortInfo ? (
              <p className="mb-md text-body-lg text-on-surface-variant">
                {product.shortInfo}
              </p>
            ) : null}

            <div className="mb-md">
              <button
                type="button"
                disabled
                className="w-full rounded-DEFAULT bg-primary px-lg py-md text-headline-md text-on-primary shadow-card disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant disabled:shadow-none"
              >
                Add to cart
              </button>
              <p className="mt-xs text-body-sm text-on-surface-variant">
                Ordering isn&apos;t available yet — Orbit serves catalogue
                content only, with no cart or order contract so far.
              </p>
            </div>

            <dl className="border-t border-surface-container-highest pt-md text-body-sm">
              <div className="flex justify-between gap-sm py-xs">
                <dt className="text-on-surface-variant">Article number</dt>
                <dd className="font-semibold tabular-nums">{product.sku}</dd>
              </div>
              <div className="flex justify-between gap-sm py-xs">
                <dt className="text-on-surface-variant">Availability</dt>
                <dd className="font-semibold">
                  {product.inStock ? "Ready to ship" : "Currently unavailable"}
                </dd>
              </div>
            </dl>

            {product.categories.length > 0 ? (
              <ul className="mt-md flex flex-wrap gap-xs border-t border-surface-container-highest pt-md">
                {product.categories.map((item) => (
                  <li
                    key={item.slug}
                    className="pill bg-surface-container text-on-surface-variant"
                  >
                    {item.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>

        {product.description ? (
          <section className="mt-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-card">
            <h2 className="mb-sm text-headline-md text-on-surface">
              Product description
            </h2>
            <p className="max-w-prose text-body-md leading-relaxed whitespace-pre-line text-on-surface-variant">
              {product.description}
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
