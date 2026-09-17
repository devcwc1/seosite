import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import type { StorefrontProduct } from "@orbit/next";

import { db } from "@/lib/db";
import {
  mediaAssets,
  productContent,
  productMedia,
  products,
  type ProductCategory,
  type ProductImage,
} from "@/lib/db/schema";
import { categoriesForProducts } from "@/lib/categories/mutations";
import { assetUrlsById } from "./assets";
import { toStorefrontProduct, type StorefrontProductRow } from "./mapper";

/** Read model behind the public storefront API. */

/** Columns needed to build a `StorefrontProduct`, joined to its live content. */
const selection = {
  id: products.id,
  slug: products.slug,
  sku: products.sku,
  priceCents: products.priceCents,
  currency: products.currency,
  inStock: products.inStock,
  stockQuantity: products.stockQuantity,
  title: productContent.title,
  shortInfo: productContent.shortInfo,
  description: productContent.description,
  /** Legacy jsonb categories — fallback for rows not yet backfilled. */
  legacyCategories: productContent.categories,
  /** Legacy jsonb gallery — only a fallback for rows not yet backfilled. */
  legacyImages: productContent.images,
  meta: productContent.meta,
  productUpdatedAt: products.updatedAt,
  contentUpdatedAt: productContent.updatedAt,
};

/**
 * Published products joined to the content revision they currently point at.
 * The inner join also drops products with no content yet, which could not
 * produce a valid DTO anyway.
 */
function selectPublished(extraFilter?: SQL) {
  const published = eq(products.status, "published");

  return db
    .select(selection)
    .from(products)
    .innerJoin(productContent, eq(productContent.id, products.currentContentId))
    .where(extraFilter ? and(published, extraFilter) : published);
}

type BaseRow = Awaited<ReturnType<typeof selectPublished>>[number];

// Fails the build if the query stops producing what the mapper expects.
type AssertRowMatchesMapper = BaseRow & {
  images: ProductImage[];
  categories: ProductCategory[];
  ogImageUrl: string | null;
  updatedAt: Date;
} extends StorefrontProductRow
  ? true
  : never;
const _rowShapeIsMappable: AssertRowMatchesMapper = true;
void _rowShapeIsMappable;

/**
 * Galleries come from `product_media` (ORB-501), not from the content snapshot
 * — the admin writes assets there, and the jsonb `images` column is legacy.
 */
async function galleriesByProduct(
  productIds: string[],
): Promise<Map<string, ProductImage[]>> {
  const galleries = new Map<string, ProductImage[]>();
  if (productIds.length === 0) return galleries;

  const rows = await db
    .select({
      productId: productMedia.productId,
      assetId: mediaAssets.id,
      externalUrl: mediaAssets.externalUrl,
      linkAlt: productMedia.alt,
      assetAlt: mediaAssets.alt,
      position: productMedia.position,
    })
    .from(productMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaAssetId))
    .where(inArray(productMedia.productId, productIds))
    .orderBy(asc(productMedia.position));

  for (const row of rows) {
    const alt = row.linkAlt ?? row.assetAlt;
    const image: ProductImage = {
      url: row.externalUrl ?? `/api/v1/media/file/${row.assetId}`,
      position: row.position,
      ...(alt ? { alt } : {}),
    };
    const existing = galleries.get(row.productId);
    if (existing) existing.push(image);
    else galleries.set(row.productId, [image]);
  }

  return galleries;
}

async function withRelations(rows: BaseRow[]): Promise<StorefrontProductRow[]> {
  const ids = rows.map((row) => row.id);
  const [galleries, categories, ogImages] = await Promise.all([
    galleriesByProduct(ids),
    categoriesForProducts(ids),
    assetUrlsById(rows.map((row) => row.meta?.ogImageAssetId)),
  ]);

  return rows.map((row) => ({
    ...row,
    ogImageUrl: row.meta?.ogImageAssetId
      ? (ogImages.get(row.meta.ogImageAssetId) ?? null)
      : null,
    // Either row changing is an edit worth telling a crawler about.
    updatedAt:
      row.contentUpdatedAt > row.productUpdatedAt
        ? row.contentUpdatedAt
        : row.productUpdatedAt,
    // The join tables are authoritative; the snapshot jsonb is only read for
    // rows that predate them and that no editor has saved since.
    images: galleries.get(row.id) ?? row.legacyImages,
    categories: categories.get(row.id) ?? row.legacyCategories,
  }));
}

export async function listStorefrontProducts(): Promise<StorefrontProduct[]> {
  const rows = await selectPublished().orderBy(products.createdAt);
  return (await withRelations(rows)).map(toStorefrontProduct);
}

export async function getStorefrontProduct(
  slug: string,
): Promise<StorefrontProduct | null> {
  const rows = await selectPublished(eq(products.slug, slug)).limit(1);
  if (rows.length === 0) return null;

  const [row] = await withRelations(rows);
  return row ? toStorefrontProduct(row) : null;
}
