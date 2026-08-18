import { and, eq, type SQL } from "drizzle-orm";
import type { StorefrontProduct } from "@orbit/next";

import { db } from "@/lib/db";
import { productContent, products } from "@/lib/db/schema";
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
  images: productContent.images,
  categories: productContent.categories,
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

// Fails the build if the query stops producing what the mapper expects.
type SelectedRow = Awaited<ReturnType<typeof selectPublished>>[number];
type AssertRowMatchesMapper = SelectedRow extends StorefrontProductRow
  ? true
  : never;
const _rowShapeIsMappable: AssertRowMatchesMapper = true;
void _rowShapeIsMappable;

export async function listStorefrontProducts(): Promise<StorefrontProduct[]> {
  const rows = await selectPublished().orderBy(products.createdAt);
  return rows.map(toStorefrontProduct);
}

export async function getStorefrontProduct(
  slug: string,
): Promise<StorefrontProduct | null> {
  const rows = await selectPublished(eq(products.slug, slug)).limit(1);
  const row = rows[0];

  return row ? toStorefrontProduct(row) : null;
}
