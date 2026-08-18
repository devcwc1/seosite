import type { StorefrontProduct } from "@orbit/next";

import type { ProductCategory, ProductImage } from "@/lib/db/schema";

/**
 * A published product joined to its live content row — the shape the storefront
 * read query selects. Declared structurally (rather than inferred from the
 * query) so this module stays free of any database import and can be unit
 * tested without a connection.
 */
export type StorefrontProductRow = {
  id: string;
  slug: string;
  sku: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
  stockQuantity: number;
  title: string;
  shortInfo: string | null;
  description: string | null;
  images: ProductImage[];
  categories: ProductCategory[];
};

/**
 * Map a joined row onto the `@orbit/next` wire DTO. The DTO type is imported
 * from the package that owns the read contract, so a change there breaks this
 * mapping at compile time instead of silently drifting.
 */
export function toStorefrontProduct(
  row: StorefrontProductRow,
): StorefrontProduct {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    title: row.title,
    shortInfo: row.shortInfo,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    // Availability = admin's in-stock flag AND actual on-hand quantity. The
    // storefront never sees the raw count, only this boolean.
    inStock: row.inStock && row.stockQuantity > 0,
    // Present images in display order; the DTO's `position` is authoritative.
    images: [...row.images].sort((a, b) => a.position - b.position),
    categories: row.categories,
  };
}
