import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { productContent, productMedia, products } from "@/lib/db/schema";

/**
 * Where a media asset is used — ORB-505.
 *
 * Two places can reference an asset, and both count: a product gallery
 * (product_media) and a product's Open Graph image (product_content.meta).
 * Counting only galleries would call an asset unused while a page still
 * points at it, which is exactly the mistake that makes a delete unsafe.
 */

export type MediaUsageKind = "gallery" | "ogImage";

export type MediaUsageRef = {
  productId: string;
  productSlug: string;
  productTitle: string;
  kind: MediaUsageKind;
};

/** SQL for the OG asset id held in a product's meta JSON. */
const OG_ASSET_ID = sql<string | null>`${productContent.meta} ->> 'ogImageAssetId'`;

/**
 * Every product that references this asset, gallery and OG together.
 *
 * A product appears once per kind, so an asset used as both a gallery image
 * and the OG image of one product lists twice — which is the truth, and what
 * someone deciding whether to delete it needs to see.
 */
export async function usageForAsset(assetId: string): Promise<MediaUsageRef[]> {
  const [gallery, og] = await Promise.all([
    db
      .selectDistinct({
        productId: products.id,
        productSlug: products.slug,
        productTitle: productContent.title,
      })
      .from(productMedia)
      .innerJoin(products, eq(productMedia.productId, products.id))
      .leftJoin(productContent, eq(productContent.productId, products.id))
      .where(eq(productMedia.mediaAssetId, assetId)),

    db
      .select({
        productId: products.id,
        productSlug: products.slug,
        productTitle: productContent.title,
      })
      .from(productContent)
      .innerJoin(products, eq(productContent.productId, products.id))
      .where(eq(OG_ASSET_ID, assetId)),
  ]);

  // The left join means a product with no content row yields a null title;
  // its slug is the honest fallback and is never null.
  const rows: MediaUsageRef[] = [
    ...gallery.map((row) => ({ ...row, kind: "gallery" as const })),
    ...og.map((row) => ({ ...row, kind: "ogImage" as const })),
  ].map((row) => ({ ...row, productTitle: row.productTitle ?? row.productSlug }));

  return rows
    .sort(
      (a, b) =>
        a.productTitle.localeCompare(b.productTitle) ||
        a.kind.localeCompare(b.kind),
    );
}

/**
 * How many references each of these assets has.
 *
 * One pair of queries for the whole grid rather than one per cell: the page
 * shows up to a hundred assets, and a query per cell is how a list page
 * becomes slow without anyone noticing which change did it.
 */
export async function usageCounts(
  assetIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (assetIds.length === 0) return counts;

  const add = (id: string | null, n: number) => {
    if (!id) return;
    counts.set(id, (counts.get(id) ?? 0) + n);
  };

  const [gallery, og] = await Promise.all([
    db
      .select({
        assetId: productMedia.mediaAssetId,
        // Distinct products: two gallery slots on one product is one user.
        n: sql<number>`count(distinct ${productMedia.productId})::int`,
      })
      .from(productMedia)
      .where(inArray(productMedia.mediaAssetId, assetIds))
      .groupBy(productMedia.mediaAssetId),

    db
      .select({
        assetId: OG_ASSET_ID,
        n: sql<number>`count(distinct ${productContent.productId})::int`,
      })
      .from(productContent)
      .where(inArray(OG_ASSET_ID, assetIds))
      .groupBy(OG_ASSET_ID),
  ]);

  for (const row of gallery) add(row.assetId, row.n);
  for (const row of og) add(row.assetId, row.n);

  return counts;
}

/**
 * Ids of every asset referenced anywhere, for the used/unused filter.
 *
 * The catalogue is capped at ~100 products, so the referenced set is small
 * enough to hold and filter in memory. At a scale where it is not, this
 * becomes an EXISTS subquery in the listing itself.
 */
export async function referencedAssetIds(): Promise<Set<string>> {
  const [gallery, og] = await Promise.all([
    db.selectDistinct({ id: productMedia.mediaAssetId }).from(productMedia),
    db.selectDistinct({ id: OG_ASSET_ID }).from(productContent),
  ]);

  const ids = new Set<string>();
  for (const row of gallery) ids.add(row.id);
  for (const row of og) if (row.id) ids.add(row.id);
  return ids;
}
