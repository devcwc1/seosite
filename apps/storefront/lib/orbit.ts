import { createOrbitClient, type StorefrontProduct } from "@orbit/next";

/**
 * The storefront's single Orbit client.
 *
 * `@orbit/next` owns the base URL (`ORBIT_API_URL`), the DTO shapes and the
 * caching policy, so there is nothing to configure here — this module exists
 * only so routes share one instance instead of constructing their own.
 */
export const orbit = createOrbitClient();

/** Render a product's price using the currency carried by the DTO. */
export function formatPrice(
  product: Pick<StorefrontProduct, "priceCents" | "currency">,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency,
  }).format(product.priceCents / 100);
}

/** A product's images in display order — `position` is authoritative. */
export function galleryImages(product: StorefrontProduct) {
  return [...product.images].sort((a, b) => a.position - b.position);
}

/** The image the catalog and PDP lead with, by the DTO's own ordering. */
export function primaryImage(product: StorefrontProduct) {
  return galleryImages(product)[0] ?? null;
}

/**
 * Does a product match a free-text query? Title, teaser and SKU are what a
 * shopper would type; matching is done here because `@orbit/next` exposes no
 * search contract — the catalog is small enough that filtering it client-side
 * of the API is honest rather than a workaround.
 */
export function matchesQuery(product: StorefrontProduct, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;

  return [product.title, product.shortInfo, product.sku]
    .filter((field): field is string => Boolean(field))
    .some((field) => field.toLowerCase().includes(needle));
}

export type CategorySummary = { slug: string; name: string; count: number };

/** Every distinct category across the catalog, with how many products it holds. */
export function allCategories(
  products: StorefrontProduct[],
): CategorySummary[] {
  const seen = new Map<string, CategorySummary>();

  for (const product of products) {
    for (const category of product.categories) {
      const existing = seen.get(category.slug);
      if (existing) existing.count += 1;
      else
        seen.set(category.slug, {
          slug: category.slug,
          name: category.name,
          count: 1,
        });
    }
  }

  return [...seen.values()];
}

/** Products filed under a category slug. */
export function inCategory(products: StorefrontProduct[], slug: string) {
  return products.filter((product) =>
    product.categories.some((category) => category.slug === slug),
  );
}

/**
 * Sort orders the catalog can actually honour. "Most popular" and "Newest"
 * are the design's other options, but the DTO carries neither sales figures
 * nor a created date, so offering them would be a guess dressed as a control.
 */
export const SORTS = {
  name: "Name A–Z",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const;

export type SortKey = keyof typeof SORTS;

export function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && value in SORTS;
}

export function sortProducts(
  products: StorefrontProduct[],
  sort: SortKey,
): StorefrontProduct[] {
  const sorted = [...products];

  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.priceCents - b.priceCents);
    case "price-desc":
      return sorted.sort((a, b) => b.priceCents - a.priceCents);
    default:
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

/**
 * The category a product is filed under. Exactly one should be primary; fall
 * back to the first so the label never disappears on inconsistent data.
 */
export function primaryCategory(product: StorefrontProduct) {
  return (
    product.categories.find((category) => category.isPrimary) ??
    product.categories[0] ??
    null
  );
}
