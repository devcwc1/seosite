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
