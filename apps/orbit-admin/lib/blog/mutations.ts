import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { db } from "@/lib/db";
import { postsCollection, type PostDoc } from "@/lib/db/mongo-collections";
import { mediaAssets, type PostStatus, type ProductMeta } from "@/lib/db/schema";
import { assetUrl } from "@/lib/media/assets";
import { toStoredMeta } from "@/lib/seo/meta";

import type { PostParsed } from "./validation";

/**
 * Posts live in MongoDB (migration in progress). Media assets are still read
 * from Postgres to resolve the cover-image URL for the edit form.
 */

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** A post plus the resolved cover-image URL, shaped for the edit form. */
export type PostEditData = {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  excerpt: string;
  body: string;
  coverImageAssetId: string;
  coverImageUrl: string;
  /** yyyy-mm-dd or "". */
  publishedAt: string;
  meta: ProductMeta;
};

export type PostListItem = {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** Body is rich text; it is sanitised here, the last point before storage. */
function toBody(input: PostParsed): string | null {
  return sanitizeRichText(input.body) || null;
}

async function slugTaken(slug: string, excludeId: string | null): Promise<boolean> {
  const row = await postsCollection().findOne(
    excludeId ? { slug, _id: { $ne: excludeId } } : { slug },
    { projection: { _id: 1 } },
  );
  return row !== null;
}

/**
 * When to stamp publishedAt: the first time a post becomes published, and
 * never after — re-saving a live post must not move its date. An explicit
 * date from the form always wins.
 */
function resolvePublishedAt(
  input: PostParsed,
  status: PostStatus,
  existing: Date | null,
): Date | null {
  if (input.publishedAt) return new Date(`${input.publishedAt}T00:00:00Z`);
  if (existing) return existing;
  return status === "published" ? new Date() : null;
}

export async function createPost(
  input: PostParsed,
  actorId: string | null,
): Promise<MutationResult> {
  if (await slugTaken(input.slug, null)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  const now = new Date();
  const doc: PostDoc = {
    _id: randomUUID(),
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt || null,
    body: toBody(input),
    coverImageAssetId: input.coverImageAssetId || null,
    status: input.status,
    publishedAt: resolvePublishedAt(input, input.status, null),
    meta: toStoredMeta(input.meta),
    authorId: actorId,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await postsCollection().insertOne(doc);
  } catch {
    return { ok: false, errors: { form: "Could not create the post." } };
  }

  await recordAudit({
    actorId,
    action: "post.created",
    target: `post:${doc._id}`,
    metadata: { slug: input.slug, status: input.status },
  });

  return { ok: true, id: doc._id };
}

export async function updatePost(
  id: string,
  input: PostParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const existing = await postsCollection().findOne({ _id: id });
  if (!existing) return { ok: false, errors: { form: "Post not found." } };

  if (await slugTaken(input.slug, id)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  await postsCollection().updateOne(
    { _id: id },
    {
      $set: {
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt || null,
        body: toBody(input),
        coverImageAssetId: input.coverImageAssetId || null,
        status: input.status,
        publishedAt: resolvePublishedAt(input, input.status, existing.publishedAt),
        meta: toStoredMeta(input.meta),
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    },
  );

  await recordAudit({
    actorId,
    action: "post.updated",
    target: `post:${id}`,
    metadata: { slug: input.slug, status: input.status },
  });

  return { ok: true, id };
}

export async function deletePost(
  id: string,
  actorId: string | null,
): Promise<MutationResult> {
  const existing = await postsCollection().findOne(
    { _id: id },
    { projection: { slug: 1 } },
  );
  if (!existing) return { ok: false, errors: { form: "Post not found." } };

  await postsCollection().deleteOne({ _id: id });

  await recordAudit({
    actorId,
    action: "post.deleted",
    target: `post:${id}`,
    metadata: { slug: existing.slug },
  });

  return { ok: true, id };
}

/** Newest first by last edit. */
export async function listPosts(): Promise<PostListItem[]> {
  const docs = await postsCollection()
    .find({}, { projection: { title: 1, slug: 1, status: 1, publishedAt: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    publishedAt: doc.publishedAt,
    updatedAt: doc.updatedAt,
  }));
}

function toIsoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function getPostForEdit(id: string): Promise<PostEditData | null> {
  const post = await postsCollection().findOne({ _id: id });
  if (!post) return null;

  let coverImageUrl = "";
  if (post.coverImageAssetId) {
    const [asset] = await db
      .select({ id: mediaAssets.id, externalUrl: mediaAssets.externalUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, post.coverImageAssetId))
      .limit(1);
    if (asset) coverImageUrl = assetUrl(asset);
  }

  return {
    id: post._id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    excerpt: post.excerpt ?? "",
    body: post.body ?? "",
    coverImageAssetId: post.coverImageAssetId ?? "",
    coverImageUrl,
    publishedAt: toIsoDate(post.publishedAt),
    meta: post.meta,
  };
}

/** Does a post use an asset as its cover? (For media-usage.) */
export function isPostCover(
  post: { coverImageAssetId: string | null },
  assetId: string,
): boolean {
  return post.coverImageAssetId === assetId;
}
