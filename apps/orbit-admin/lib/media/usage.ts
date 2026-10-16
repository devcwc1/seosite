import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { pagesCollection, postsCollection } from "@/lib/db/mongo-collections";
import {
  categories,
  productContent,
  productMedia,
  products,
  settings,
} from "@/lib/db/schema";
import { SITE_SEO_SETTING_KEY } from "@/lib/seo/site-settings";

/**
 * Where a media asset is used — ORB-505.
 *
 * Every place that can reference an asset counts: product galleries, product
 * and category share images, post covers and share images, page share images,
 * and the site-wide default share image and logo. Missing any one would call an
 * asset unused while something still points at it — exactly the mistake that
 * makes a delete unsafe.
 *
 * Migration in progress: posts and pages are read from MongoDB; products,
 * categories and settings are still read from Postgres.
 */

export type MediaUsageKind =
  | "gallery"
  | "ogImage"
  | "categoryOgImage"
  | "postCover"
  | "postOgImage"
  | "pageOgImage"
  | "siteDefaultOgImage"
  | "siteLogo";

export type MediaUsageRef = {
  kind: MediaUsageKind;
  /** The product or category id; the settings key for site-wide uses. */
  targetId: string;
  title: string;
  /** Where in the admin to change it. */
  href: string;
};

/** SQL for an asset id held in a jsonb column under the given key. */
function jsonAssetId(
  column: typeof productContent.meta | typeof categories.meta,
  key: string,
) {
  return sql<string | null>`${column} ->> ${sql.raw(`'${key}'`)}`;
}

const PRODUCT_OG = jsonAssetId(productContent.meta, "ogImageAssetId");
const CATEGORY_OG = jsonAssetId(categories.meta, "ogImageAssetId");
const SITE_DEFAULT_OG = sql<string | null>`${settings.value} ->> 'defaultOgImageAssetId'`;
const SITE_LOGO = sql<string | null>`${settings.value} ->> 'logoAssetId'`;

type IdTitle = { id: string; title: string };

/**
 * Every place this asset is referenced.
 *
 * A product appears once per kind of use, so an asset that is both a gallery
 * image and the share image of one product lists twice — which is the truth,
 * and what someone deciding whether to delete it needs to see.
 */
export async function usageForAsset(assetId: string): Promise<MediaUsageRef[]> {
  const [gallery, productOg, categoryOg, postCover, postOg, pageOg, site] =
    await Promise.all([
      db
        .selectDistinct({
          id: products.id,
          slug: products.slug,
          title: productContent.title,
        })
        .from(productMedia)
        .innerJoin(products, eq(productMedia.productId, products.id))
        .leftJoin(productContent, eq(productContent.productId, products.id))
        .where(eq(productMedia.mediaAssetId, assetId)),

      db
        .select({ id: products.id, slug: products.slug, title: productContent.title })
        .from(productContent)
        .innerJoin(products, eq(productContent.productId, products.id))
        .where(eq(PRODUCT_OG, assetId)),

      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(CATEGORY_OG, assetId)),

      postsCollection()
        .find({ coverImageAssetId: assetId }, { projection: { title: 1 } })
        .toArray()
        .then((docs): IdTitle[] => docs.map((d) => ({ id: d._id, title: d.title }))),

      postsCollection()
        .find({ "meta.ogImageAssetId": assetId }, { projection: { title: 1 } })
        .toArray()
        .then((docs): IdTitle[] => docs.map((d) => ({ id: d._id, title: d.title }))),

      pagesCollection()
        .find({ "meta.ogImageAssetId": assetId }, { projection: { title: 1 } })
        .toArray()
        .then((docs): IdTitle[] => docs.map((d) => ({ id: d._id, title: d.title }))),

      db
        .select({ defaultOg: SITE_DEFAULT_OG, logo: SITE_LOGO })
        .from(settings)
        .where(eq(settings.key, SITE_SEO_SETTING_KEY))
        .limit(1),
    ]);

  // A product with no content row has no title; its slug is never null.
  const refs: MediaUsageRef[] = [
    ...gallery.map((row) => ({
      kind: "gallery" as const,
      targetId: row.id,
      title: row.title ?? row.slug,
      href: `/products/${row.id}`,
    })),
    ...productOg.map((row) => ({
      kind: "ogImage" as const,
      targetId: row.id,
      title: row.title ?? row.slug,
      href: `/products/${row.id}`,
    })),
    ...categoryOg.map((row) => ({
      kind: "categoryOgImage" as const,
      targetId: row.id,
      title: row.name,
      href: `/categories/${row.id}/edit`,
    })),
    ...postCover.map((row) => ({
      kind: "postCover" as const,
      targetId: row.id,
      title: row.title,
      href: `/blog/${row.id}/edit`,
    })),
    ...postOg.map((row) => ({
      kind: "postOgImage" as const,
      targetId: row.id,
      title: row.title,
      href: `/blog/${row.id}/edit`,
    })),
    ...pageOg.map((row) => ({
      kind: "pageOgImage" as const,
      targetId: row.id,
      title: row.title,
      href: `/pages/${row.id}/edit`,
    })),
  ];

  const siteRow = site[0];
  if (siteRow?.defaultOg === assetId) {
    refs.push({
      kind: "siteDefaultOgImage",
      targetId: SITE_SEO_SETTING_KEY,
      title: "Site settings",
      href: "/settings",
    });
  }
  if (siteRow?.logo === assetId) {
    refs.push({
      kind: "siteLogo",
      targetId: SITE_SEO_SETTING_KEY,
      title: "Site settings",
      href: "/settings",
    });
  }

  return refs.sort(
    (a, b) => a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind),
  );
}

type IdCount = { assetId: string | null; n: number };

/** Count distinct documents per asset id, from a Mongo field. */
async function mongoCounts(
  collection: ReturnType<typeof postsCollection> | ReturnType<typeof pagesCollection>,
  field: string,
  assetIds: string[],
): Promise<IdCount[]> {
  const rows = await collection
    .aggregate([
      { $match: { [field]: { $in: assetIds } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ])
    .toArray();
  return rows.map((r) => ({ assetId: r._id as string | null, n: r.n as number }));
}

/**
 * How many references each of these assets has, in one pass for the page.
 *
 * A query per grid cell is how a list page becomes slow without anyone
 * noticing which change did it.
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

  const [gallery, productOg, categoryOg, postCover, postOg, pageOg, site] =
    await Promise.all([
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
          assetId: PRODUCT_OG,
          n: sql<number>`count(distinct ${productContent.productId})::int`,
        })
        .from(productContent)
        .where(inArray(PRODUCT_OG, assetIds))
        .groupBy(PRODUCT_OG),

      db
        .select({
          assetId: CATEGORY_OG,
          n: sql<number>`count(distinct ${categories.id})::int`,
        })
        .from(categories)
        .where(inArray(CATEGORY_OG, assetIds))
        .groupBy(CATEGORY_OG),

      mongoCounts(postsCollection(), "coverImageAssetId", assetIds),
      mongoCounts(postsCollection(), "meta.ogImageAssetId", assetIds),
      mongoCounts(pagesCollection(), "meta.ogImageAssetId", assetIds),

      db
        .select({ defaultOg: SITE_DEFAULT_OG, logo: SITE_LOGO })
        .from(settings)
        .where(eq(settings.key, SITE_SEO_SETTING_KEY))
        .limit(1),
    ]);

  for (const row of gallery) add(row.assetId, row.n);
  for (const row of productOg) add(row.assetId, row.n);
  for (const row of categoryOg) add(row.assetId, row.n);
  for (const row of postCover) add(row.assetId, row.n);
  for (const row of postOg) add(row.assetId, row.n);
  for (const row of pageOg) add(row.assetId, row.n);

  const wanted = new Set(assetIds);
  const siteRow = site[0];
  if (siteRow?.defaultOg && wanted.has(siteRow.defaultOg)) add(siteRow.defaultOg, 1);
  if (siteRow?.logo && wanted.has(siteRow.logo)) add(siteRow.logo, 1);

  return counts;
}

/**
 * Ids of every asset referenced anywhere, for the used/unused filter.
 *
 * The catalogue is capped at ~100 products, so the referenced set is small
 * enough to hold in memory. At a scale where it is not, this becomes an
 * EXISTS subquery in the listing itself.
 */
export async function referencedAssetIds(): Promise<Set<string>> {
  const [gallery, productOg, categoryOg, postCover, postOg, pageOg, site] =
    await Promise.all([
      db.selectDistinct({ id: productMedia.mediaAssetId }).from(productMedia),
      db.selectDistinct({ id: PRODUCT_OG }).from(productContent),
      db.selectDistinct({ id: CATEGORY_OG }).from(categories),
      postsCollection().distinct("coverImageAssetId") as Promise<(string | null)[]>,
      postsCollection().distinct("meta.ogImageAssetId") as Promise<(string | null)[]>,
      pagesCollection().distinct("meta.ogImageAssetId") as Promise<(string | null)[]>,
      db
        .select({ defaultOg: SITE_DEFAULT_OG, logo: SITE_LOGO })
        .from(settings)
        .where(eq(settings.key, SITE_SEO_SETTING_KEY))
        .limit(1),
    ]);

  const ids = new Set<string>();
  for (const row of gallery) ids.add(row.id);
  for (const row of productOg) if (row.id) ids.add(row.id);
  for (const row of categoryOg) if (row.id) ids.add(row.id);
  for (const id of postCover) if (id) ids.add(id);
  for (const id of postOg) if (id) ids.add(id);
  for (const id of pageOg) if (id) ids.add(id);
  if (site[0]?.defaultOg) ids.add(site[0].defaultOg);
  if (site[0]?.logo) ids.add(site[0].logo);
  return ids;
}
