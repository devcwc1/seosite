import type { StorefrontProduct, StorefrontSeo } from "@orbit/next";

import type { ProductCategory, ProductImage, ProductMeta } from "@/lib/db/model-types";

/**
 * Stored page meta onto the wire shape. Values are passed through as the
 * editor set them, or null — never a fallback. Choosing "the product name
 * when there is no meta title" is the storefront's decision, and baking it in
 * here would stop a consumer telling "set" from "inherited".
 */
export function toStorefrontSeo(
  meta: ProductMeta | null | undefined,
  ogImageUrl: string | null,
): StorefrontSeo {
  return {
    title: meta?.title || null,
    description: meta?.description || null,
    keywords: meta?.keywords || null,
    // Only resolved when the asset still exists; a deleted image is no image.
    ogImageUrl,
    noindex: meta?.noindex === true,
    canonicalUrl: meta?.canonicalUrl || null,
  };
}

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
  meta: ProductMeta;
  /** Resolved from meta.ogImageAssetId by the read query. */
  ogImageUrl: string | null;
  /** The later of the product row and its content row. */
  updatedAt: Date;
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
    seo: toStorefrontSeo(row.meta, row.ogImageUrl),
    updatedAt: row.updatedAt.toISOString(),
  };
}
