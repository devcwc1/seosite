import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { db } from "@/lib/db";
import { mediaAssets, pages, type PageStatus, type ProductMeta } from "@/lib/db/schema";
import { assetUrl } from "@/lib/media/assets";
import { toStoredMeta } from "@/lib/seo/meta";

import type { PageParsed } from "./validation";

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** A page row shaped for the edit form, with the OG image URL resolved. */
export type PageEditData = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  content: string;
  meta: ProductMeta;
  /** Resolved URL for meta.ogImageAssetId, for the SEO preview. */
  ogImageUrl: string;
};

export type PageListItem = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  updatedAt: Date;
};

/** Content is rich text; it is sanitised here, the last point before storage. */
function toContent(input: PageParsed): string | null {
  return sanitizeRichText(input.content) || null;
}

async function slugTaken(slug: string, excludeId: string | null): Promise<boolean> {
  const [row] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(excludeId ? and(eq(pages.slug, slug), ne(pages.id, excludeId)) : eq(pages.slug, slug))
    .limit(1);
  return row !== undefined;
}

export async function createPage(
  input: PageParsed,
  actorId: string | null,
): Promise<MutationResult> {
  if (await slugTaken(input.slug, null)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  const [row] = await db
    .insert(pages)
    .values({
      slug: input.slug,
      title: input.title,
      content: toContent(input),
      status: input.status,
      meta: toStoredMeta(input.meta),
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: pages.id });
  if (!row) return { ok: false, errors: { form: "Could not create the page." } };

  await recordAudit({
    actorId,
    action: "page.created",
    target: `page:${row.id}`,
    metadata: { slug: input.slug, status: input.status },
  });

  return { ok: true, id: row.id };
}

export async function updatePage(
  id: string,
  input: PageParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const [existing] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!existing) return { ok: false, errors: { form: "Page not found." } };

  if (await slugTaken(input.slug, id)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  await db
    .update(pages)
    .set({
      slug: input.slug,
      title: input.title,
      content: toContent(input),
      status: input.status,
      meta: toStoredMeta(input.meta),
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, id));

  await recordAudit({
    actorId,
    action: "page.updated",
    target: `page:${id}`,
    metadata: { slug: input.slug, status: input.status },
  });

  return { ok: true, id };
}

export async function deletePage(
  id: string,
  actorId: string | null,
): Promise<MutationResult> {
  const [existing] = await db
    .select({ slug: pages.slug })
    .from(pages)
    .where(eq(pages.id, id))
    .limit(1);
  if (!existing) return { ok: false, errors: { form: "Page not found." } };

  await db.delete(pages).where(eq(pages.id, id));

  await recordAudit({
    actorId,
    action: "page.deleted",
    target: `page:${id}`,
    metadata: { slug: existing.slug },
  });

  return { ok: true, id };
}

/** Newest edit first. */
export async function listPages(): Promise<PageListItem[]> {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .orderBy(desc(pages.updatedAt));
}

export async function getPageForEdit(id: string): Promise<PageEditData | null> {
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) return null;

  let ogImageUrl = "";
  const ogImageAssetId = page.meta.ogImageAssetId;
  if (ogImageAssetId) {
    const [asset] = await db
      .select({ id: mediaAssets.id, externalUrl: mediaAssets.externalUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, ogImageAssetId))
      .limit(1);
    if (asset) ogImageUrl = assetUrl(asset);
  }

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    content: page.content ?? "",
    meta: page.meta,
    ogImageUrl,
  };
}
