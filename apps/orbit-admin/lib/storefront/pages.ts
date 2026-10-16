import "server-only";

import type { StorefrontPage } from "@orbit/next";

import { pagesCollection, type PageDoc } from "@/lib/db/mongo-collections";

import { assetUrlsById } from "./assets";
import { toStorefrontSeo } from "./mapper";

/**
 * Read model behind the public pages API.
 *
 * Only published pages are served; a draft or archived page has no public URL,
 * exactly like an unpublished product or post. Pages live in MongoDB; media
 * assets are still resolved from Postgres.
 */

async function toDtos(rows: PageDoc[]): Promise<StorefrontPage[]> {
  const ogUrls = await assetUrlsById(rows.map((row) => row.meta?.ogImageAssetId));
  return rows.map((row) => {
    const ogId = row.meta?.ogImageAssetId;
    return {
      slug: row.slug,
      title: row.title,
      content: row.content,
      seo: toStorefrontSeo(row.meta, ogId ? (ogUrls.get(ogId) ?? null) : null),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function listStorefrontPages(): Promise<StorefrontPage[]> {
  const rows = await pagesCollection()
    .find({ status: "published" })
    .sort({ updatedAt: -1 })
    .toArray();
  return toDtos(rows);
}

export async function getStorefrontPage(slug: string): Promise<StorefrontPage | null> {
  const row = await pagesCollection().findOne({ slug, status: "published" });
  if (!row) return null;
  const [dto] = await toDtos([row]);
  return dto ?? null;
}
