import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { StorefrontPage } from "@orbit/next";

import { db } from "@/lib/db";
import { pages, type Page } from "@/lib/db/schema";

import { assetUrlsById } from "./assets";
import { toStorefrontSeo } from "./mapper";

/**
 * Read model behind the public pages API.
 *
 * Only published pages are served; a draft or archived page has no public URL,
 * exactly like an unpublished product or post.
 */
const publishedOnly = eq(pages.status, "published");

async function toDtos(rows: Page[]): Promise<StorefrontPage[]> {
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
  const rows = await db
    .select()
    .from(pages)
    .where(publishedOnly)
    .orderBy(desc(pages.updatedAt));
  return toDtos(rows);
}

export async function getStorefrontPage(slug: string): Promise<StorefrontPage | null> {
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), publishedOnly))
    .limit(1);
  if (rows.length === 0) return null;
  const [dto] = await toDtos(rows);
  return dto ?? null;
}
