import { asc, eq, sql } from "drizzle-orm";
import type { StorefrontCategory } from "@orbit/next";

import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  products,
  type ProductMeta,
} from "@/lib/db/schema";

import { assetUrlsById } from "./assets";
import { toStorefrontSeo } from "./mapper";

/**
 * Read model behind the public category API.
 *
 * The product count only counts published products: an archive page that
 * advertises twelve items and shows three would be worse than no count.
 */
const publishedCount = sql<number>`count(distinct case when ${products.status} = 'published' then ${products.id} end)`;

const selection = {
  slug: categories.slug,
  name: categories.name,
  description: categories.description,
  meta: categories.meta,
  position: categories.position,
  productCount: publishedCount,
  updatedAt: categories.updatedAt,
};

type CategoryRow = {
  slug: string;
  name: string;
  description: string | null;
  meta: ProductMeta;
  position: number;
  productCount: number;
  updatedAt: Date;
};

function toDto(row: CategoryRow, ogImageUrls: Map<string, string>): StorefrontCategory {
  const ogId = row.meta?.ogImageAssetId;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    seo: toStorefrontSeo(row.meta, ogId ? (ogImageUrls.get(ogId) ?? null) : null),
    position: row.position,
    productCount: Number(row.productCount),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toDtos(rows: CategoryRow[]): Promise<StorefrontCategory[]> {
  const urls = await assetUrlsById(rows.map((row) => row.meta?.ogImageAssetId));
  return rows.map((row) => toDto(row, urls));
}

export async function listStorefrontCategories(): Promise<
  StorefrontCategory[]
> {
  const rows = await db
    .select(selection)
    .from(categories)
    .leftJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id),
    )
    .leftJoin(products, eq(products.id, productCategories.productId))
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name));

  return toDtos(rows);
}

export async function getStorefrontCategory(
  slug: string,
): Promise<StorefrontCategory | null> {
  const rows = await db
    .select(selection)
    .from(categories)
    .leftJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id),
    )
    .leftJoin(products, eq(products.id, productCategories.productId))
    .where(eq(categories.slug, slug))
    .groupBy(categories.id)
    .limit(1);

  const [dto] = await toDtos(rows);
  return dto ?? null;
}
