import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { StorefrontProduct } from "@orbit/next";

import {
  ArrowRightIcon,
  CartIcon,
  ImagePlaceholderIcon,
  PlugIcon,
  ShieldIcon,
} from "@/components/icons";
import { addToCartAction } from "@/lib/cart-actions";
import { MAX_QUANTITY } from "@/lib/cart";
import {
  formatPrice,
  galleryImages,
  orbit,
  primaryCategory,
  primaryImage,
} from "@/lib/orbit";

/**
 * The `[id]` segment carries a product's public slug — the stable identifier
 * `@orbit/next` looks products up by (`OrbitClient.getProduct`).
 */
type ProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = {
  description: "Description",
  specifications: "Specifications",
} as const;

type TabKey = keyof typeof TABS;

const RELATED_COUNT = 4;

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

/** The design's related-product card: image, title, price, one action. */
function RelatedCard({ product }: { product: StorefrontProduct }) {
  const image = primaryImage(product);

  return (
    <li>
      <Link
        href={`/products/${product.slug}`}
        className="group flex h-full flex-col rounded-lg border border-border-subtle bg-surface-container-lowest p-sm transition-shadow duration-300 hover:shadow-lift"
      >
        <div className="relative mb-sm flex aspect-[1.4] items-center justify-center">
          {image ? (
            /* Remote URLs from the content API bypass next/image's allow-list. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt ?? product.title}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholderIcon className="size-8 text-outline" />
          )}
        </div>

        <h3 className="mb-xs line-clamp-2 text-headline-sm text-on-surface">
          {product.title}
        </h3>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-price-display text-primary">
            {formatPrice(product)}
          </span>
          <span
            aria-hidden
            className="rounded-full p-xs text-primary transition-colors group-hover:bg-surface-container-low"
          >
            <ArrowRightIcon className="size-5" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  const product = await loadProduct(id);
  if (!product) notFound();

  const activeTab: TabKey = tab === "specifications" ? tab : "description";
  const images = galleryImages(product);
  const [lead, ...rest] = images;
  const category = primaryCategory(product);

  // Related products share this one's category. The catalog is fetched again
  // rather than threaded through, because the SDK caches it either way.
  let related: StorefrontProduct[] = [];
  try {
    const all = await orbit.listProducts();
    const others = all.filter((item) => item.id !== product.id);
    const sameCategory = category
      ? others.filter((item) =>
          item.categories.some((c) => c.slug === category.slug),
        )
      : [];
    related = [
      ...sameCategory,
      ...others.filter((item) => !sameCategory.includes(item)),
    ].slice(0, RELATED_COUNT);
  } catch {
    related = [];
  }

  return (
    <main className="shell py-section-gap">
      <nav aria-label="Breadcrumb" className="mb-lg">
        <ol className="flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>›</li>
          {category ? (
            <>
              <li>
                <Link
                  href={`/categories/${category.slug}`}
                  className="transition-colors hover:text-primary"
                >
                  {category.name}
                </Link>
              </li>
              <li aria-hidden>›</li>
            </>
          ) : null}
          <li aria-current="page" className="font-medium text-on-surface">
            {product.title}
          </li>
        </ol>
      </nav>

      {/* -- product ------------------------------------------------------- */}
      <div className="mb-section-gap grid grid-cols-1 gap-lg md:grid-cols-2">
        <div className="flex flex-col gap-sm">
          <div className="flex items-center justify-center rounded-lg border border-border-subtle bg-surface-container-lowest p-lg">
            {lead ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lead.url}
                alt={lead.alt ?? product.title}
                className="w-full max-w-[350px] object-contain"
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
                  className="flex aspect-square items-center justify-center overflow-hidden rounded-DEFAULT border border-border-subtle bg-surface-container-lowest p-xs"
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

        <div className="flex flex-col justify-center">
          <h1 className="mb-sm text-headline-lg text-balance text-on-surface md:text-display-lg">
            {product.title}
          </h1>

          <p className="mb-md flex items-center gap-xs text-label-md">
            <span
              aria-hidden
              className={`size-2 rounded-full ${
                product.inStock ? "bg-success-green" : "bg-secondary-container"
              }`}
            />
            <span
              className={
                product.inStock ? "text-success-green" : "text-on-surface-variant"
              }
            >
              {product.inStock ? "In stock" : "Out of stock"}
            </span>
          </p>

          <p className="mb-lg text-price-display text-primary">
            {formatPrice(product)}
          </p>

          {product.shortInfo ? (
            <p className="mb-lg text-body-lg text-on-surface-variant">
              {product.shortInfo}
            </p>
          ) : null}

          {/* The design's quantity stepper, as a number input: the +/- buttons
              would need JavaScript, and this works without any. */}
          <form
            action={addToCartAction}
            className="mb-md flex items-stretch gap-sm"
          >
            <input type="hidden" name="slug" value={product.slug} />
            <label htmlFor="quantity" className="sr-only">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              name="quantity"
              min={1}
              max={MAX_QUANTITY}
              defaultValue={1}
              className="w-20 rounded-DEFAULT border border-border-subtle bg-surface-container-lowest px-sm py-xs text-center text-body-md"
            />
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-xs rounded-DEFAULT bg-primary-container px-lg py-sm text-label-md text-on-primary shadow-card transition-colors hover:bg-primary"
            >
              <CartIcon className="size-5" />
              Add to cart
            </button>
          </form>

          <div className="rounded-lg border border-border-subtle bg-surface-muted p-md">
            <ul className="flex flex-col gap-sm">
              <li className="flex items-start gap-sm text-body-md text-on-surface-variant">
                <PlugIcon className="mt-base size-5 shrink-0 text-primary" />
                The cart is real and survives a reload, but there is no
                checkout behind it yet — Orbit does not own orders.
              </li>
              <li className="flex items-start gap-sm text-body-md text-on-surface-variant">
                <ShieldIcon className="mt-base size-5 shrink-0 text-primary" />
                Every image here was sniffed, re-encoded and stored
                content-addressed before it reached this page.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* -- tabs ---------------------------------------------------------- */}
      <div className="mb-section-gap">
        <div className="mb-md border-b border-border-subtle">
          {/* Tabs as links: each panel has its own URL, works without
              JavaScript, and can be linked to directly. */}
          <nav aria-label="Product information" className="flex gap-lg">
            {(Object.keys(TABS) as TabKey[]).map((key) => {
              const active = key === activeTab;

              return (
                <Link
                  key={key}
                  href={`/products/${product.slug}${
                    key === "description" ? "" : `?tab=${key}`
                  }`}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 pb-sm text-headline-sm transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {TABS[key]}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="max-w-prose text-body-lg text-on-surface-variant">
          {activeTab === "description" ? (
            product.description ? (
              /* Rich text from the admin. Orbit sanitises it on write against
                 a strict allowlist, so what arrives here is headings,
                 paragraphs, lists and links — nothing executable. */
              <div
                className="rich-text"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p>No description has been published for this product yet.</p>
            )
          ) : (
            <dl className="grid grid-cols-1 gap-x-lg sm:grid-cols-2">
              <div className="flex justify-between gap-sm border-b border-border-subtle py-xs">
                <dt>Article number</dt>
                <dd className="font-semibold tabular-nums text-on-surface">
                  {product.sku}
                </dd>
              </div>
              <div className="flex justify-between gap-sm border-b border-border-subtle py-xs">
                <dt>Availability</dt>
                <dd className="font-semibold text-on-surface">
                  {product.inStock ? "Ready to ship" : "Currently unavailable"}
                </dd>
              </div>
              <div className="flex justify-between gap-sm border-b border-border-subtle py-xs">
                <dt>Price</dt>
                <dd className="font-semibold text-on-surface">
                  {formatPrice(product)}
                </dd>
              </div>
              <div className="flex justify-between gap-sm border-b border-border-subtle py-xs">
                <dt>Categories</dt>
                <dd className="text-right font-semibold text-on-surface">
                  {product.categories.length > 0
                    ? product.categories.map((item) => item.name).join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {/* -- related ------------------------------------------------------- */}
      {related.length > 0 ? (
        <section>
          <h2 className="mb-lg text-headline-md text-on-surface">
            Related products
          </h2>
          <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <RelatedCard key={item.id} product={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
