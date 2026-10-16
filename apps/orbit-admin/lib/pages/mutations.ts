import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/content/sanitize";
import {
  mediaAssetsCollection,
  pagesCollection,
  type PageDoc,
} from "@/lib/db/mongo-collections";
import { type PageStatus, type ProductMeta } from "@/lib/db/model-types";
import { assetUrl } from "@/lib/media/assets";
import { toStoredMeta } from "@/lib/seo/meta";

import type { PageParsed } from "./validation";

/**
 * Pages live in MongoDB (migration in progress). Media assets are still read
 * from Postgres to resolve the OG-image URL for the edit form.
 */

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** A page plus the resolved OG-image URL, shaped for the edit form. */
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
  const row = await pagesCollection().findOne(
    excludeId ? { slug, _id: { $ne: excludeId } } : { slug },
    { projection: { _id: 1 } },
  );
  return row !== null;
}

export async function createPage(
  input: PageParsed,
  actorId: string | null,
): Promise<MutationResult> {
  if (await slugTaken(input.slug, null)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  const now = new Date();
  const doc: PageDoc = {
    _id: randomUUID(),
    slug: input.slug,
    title: input.title,
    content: toContent(input),
    status: input.status,
    meta: toStoredMeta(input.meta),
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await pagesCollection().insertOne(doc);
  } catch {
    return { ok: false, errors: { form: "Could not create the page." } };
  }

  await recordAudit({
    actorId,
    action: "page.created",
    target: `page:${doc._id}`,
    metadata: { slug: input.slug, status: input.status },
  });

  return { ok: true, id: doc._id };
}

export async function updatePage(
  id: string,
  input: PageParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const existing = await pagesCollection().findOne(
    { _id: id },
    { projection: { _id: 1 } },
  );
  if (!existing) return { ok: false, errors: { form: "Page not found." } };

  if (await slugTaken(input.slug, id)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  await pagesCollection().updateOne(
    { _id: id },
    {
      $set: {
        slug: input.slug,
        title: input.title,
        content: toContent(input),
        status: input.status,
        meta: toStoredMeta(input.meta),
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    },
  );

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
  const existing = await pagesCollection().findOne(
    { _id: id },
    { projection: { slug: 1 } },
  );
  if (!existing) return { ok: false, errors: { form: "Page not found." } };

  await pagesCollection().deleteOne({ _id: id });

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
  const docs = await pagesCollection()
    .find({}, { projection: { title: 1, slug: 1, status: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    updatedAt: doc.updatedAt,
  }));
}

export async function getPageForEdit(id: string): Promise<PageEditData | null> {
  const page = await pagesCollection().findOne({ _id: id });
  if (!page) return null;

  let ogImageUrl = "";
  const ogImageAssetId = page.meta.ogImageAssetId;
  if (ogImageAssetId) {
    const asset = await mediaAssetsCollection().findOne(
      { _id: ogImageAssetId },
      { projection: { externalUrl: 1 } },
    );
    if (asset) ogImageUrl = assetUrl({ id: asset._id, externalUrl: asset.externalUrl });
  }

  return {
    id: page._id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    content: page.content ?? "",
    meta: page.meta,
    ogImageUrl,
  };
}
