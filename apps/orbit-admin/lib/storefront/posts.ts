import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { StorefrontPost } from "@orbit/next";

import { db } from "@/lib/db";
import { posts, type Post } from "@/lib/db/schema";

import { assetUrlsById } from "./assets";
import { toStorefrontSeo } from "./mapper";

/**
 * Read model behind the public blog API.
 *
 * Only published posts are served, newest first by publish date. A draft or
 * archived post has no public page, exactly like an unpublished product.
 */
const publishedOnly = and(eq(posts.status, "published"), isNotNull(posts.publishedAt));

async function toDtos(rows: Post[]): Promise<StorefrontPost[]> {
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
        ogId ? (covers.get(ogId) ?? null) : row.coverImageAssetId
          ? (covers.get(row.coverImageAssetId) ?? null)
          : null,
      ),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function listStorefrontPosts(): Promise<StorefrontPost[]> {
  const rows = await db
    .select()
    .from(posts)
    .where(publishedOnly)
    .orderBy(desc(posts.publishedAt));
  return toDtos(rows);
}

export async function getStorefrontPost(slug: string): Promise<StorefrontPost | null> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), publishedOnly))
    .limit(1);
  if (rows.length === 0) return null;
  const [dto] = await toDtos(rows);
  return dto ?? null;
}
