import { asc, eq, sql } from "drizzle-orm";
import type { StorefrontCategory } from "@orbit/next";

import { db } from "@/lib/db";
import { categories, productCategories, products } from "@/lib/db/schema";

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
};

function toDto(row: {
  slug: string;
  name: string;
  description: string | null;
  meta: { title?: string; description?: string; keywords?: string };
  position: number;
  productCount: number;
}): StorefrontCategory {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    meta: row.meta,
    position: row.position,
    productCount: Number(row.productCount),
  };
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

  return rows.map(toDto);
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

  const row = rows[0];
  return row ? toDto(row) : null;
}
