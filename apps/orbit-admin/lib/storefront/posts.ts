import "server-only";

import type { StorefrontPost } from "@orbit/next";

import { postsCollection, type PostDoc } from "@/lib/db/mongo-collections";

import { assetUrlsById } from "./assets";
import { toStorefrontSeo } from "./mapper";

/**
 * Read model behind the public blog API.
 *
 * Only published posts are served, newest first by publish date. A draft or
 * archived post has no public page, exactly like an unpublished product. Posts
 * live in MongoDB; media assets are still resolved from Postgres.
 */
const PUBLISHED = { status: "published", publishedAt: { $ne: null } } as const;

async function toDtos(rows: PostDoc[]): Promise<StorefrontPost[]> {
  const covers = await assetUrlsById(rows.map((row) => row.coverImageAssetId));
  return rows.map((row) => {
    const ogId = row.meta?.ogImageAssetId;
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      coverImageUrl: row.coverImageAssetId
        ? (covers.get(row.coverImageAssetId) ?? null)
        : null,
      // Share image falls back to the cover when the editor set no OG image.
      seo: toStorefrontSeo(
        row.meta,
        ogId
          ? (covers.get(ogId) ?? null)
          : row.coverImageAssetId
            ? (covers.get(row.coverImageAssetId) ?? null)
            : null,
      ),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function listStorefrontPosts(): Promise<StorefrontPost[]> {
  const rows = await postsCollection()
    .find(PUBLISHED)
    .sort({ publishedAt: -1 })
    .toArray();
  return toDtos(rows);
}

export async function getStorefrontPost(slug: string): Promise<StorefrontPost | null> {
  const row = await postsCollection().findOne({ slug, ...PUBLISHED });
  if (!row) return null;
  const [dto] = await toDtos([row]);
  return dto ?? null;
}
