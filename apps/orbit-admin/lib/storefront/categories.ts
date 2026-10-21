import type { StorefrontCategory } from "@orbit/next";

import {
  categoriesCollection,
  productsCollection,
  type CategoryDoc,
} from "@/lib/db/mongo-collections";

import { assetUrlsById } from "./assets";
import { toStorefrontSeo } from "./mapper";

/**
 * Read model behind the public category API. Categories live in MongoDB; the
 * product count comes from the embedded category refs on published products.
 *
 * The count only counts published products: an archive page that advertises
 * twelve items and shows three would be worse than no count.
 */

/** Distinct published products per category id. */
async function publishedCountsByCategory(): Promise<Map<string, number>> {
  const rows = await productsCollection()
    .aggregate([
      { $match: { status: "published" } },
      { $unwind: "$content.categories" },
      { $group: { _id: { cat: "$content.categories.categoryId", product: "$_id" } } },
      { $group: { _id: "$_id.cat", n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id as string, r.n as number]));
}

function toDto(
  doc: CategoryDoc,
  productCount: number,
  ogImageUrls: Map<string, string>,
): StorefrontCategory {
  const ogId = doc.meta?.ogImageAssetId;
  return {
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    seo: toStorefrontSeo(doc.meta, ogId ? (ogImageUrls.get(ogId) ?? null) : null),
    position: doc.position,
    productCount,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listStorefrontCategories(): Promise<StorefrontCategory[]> {
  const [docs, counts] = await Promise.all([
    categoriesCollection().find({}).sort({ position: 1, name: 1 }).toArray(),
    publishedCountsByCategory(),
  ]);
  const urls = await assetUrlsById(docs.map((d) => d.meta?.ogImageAssetId));
  return docs.map((doc) => toDto(doc, counts.get(doc._id) ?? 0, urls));
}

export async function getStorefrontCategory(
  slug: string,
): Promise<StorefrontCategory | null> {
  const doc = await categoriesCollection().findOne({ slug });
  if (!doc) return null;

  const [counts, urls] = await Promise.all([
    publishedCountsByCategory(),
    assetUrlsById([doc.meta?.ogImageAssetId]),
  ]);
  return toDto(doc, counts.get(doc._id) ?? 0, urls);
}
