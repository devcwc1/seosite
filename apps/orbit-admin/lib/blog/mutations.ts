import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { db } from "@/lib/db";
import { posts, type Post, type PostStatus, type ProductMeta } from "@/lib/db/schema";
import { assetUrl } from "@/lib/media/assets";
import { toStoredMeta } from "@/lib/seo/meta";
import { mediaAssets } from "@/lib/db/schema";

import type { PostParsed } from "./validation";

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** A post row plus the resolved cover-image URL, shaped for the edit form. */
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
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(excludeId ? and(eq(posts.slug, slug), ne(posts.id, excludeId)) : eq(posts.slug, slug))
    .limit(1);
  return row !== undefined;
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

  const [row] = await db
    .insert(posts)
    .values({
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
    })
    .returning({ id: posts.id });
  if (!row) return { ok: false, errors: { form: "Could not create the post." } };

  await recordAudit({
    actorId,
    action: "post.created",
    target: `post:${row.id}`,
    metadata: { slug: input.slug, status: input.status },
  });

  return { ok: true, id: row.id };
}

export async function updatePost(
  id: string,
  input: PostParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const [existing] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!existing) return { ok: false, errors: { form: "Post not found." } };

  if (await slugTaken(input.slug, id)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  await db
    .update(posts)
    .set({
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
    })
    .where(eq(posts.id, id));

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
  const [existing] = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!existing) return { ok: false, errors: { form: "Post not found." } };

  await db.delete(posts).where(eq(posts.id, id));

  await recordAudit({
    actorId,
    action: "post.deleted",
    target: `post:${id}`,
    metadata: { slug: existing.slug },
  });

  return { ok: true, id };
}

/** Newest first: published by publish date, drafts by last edit. */
export async function listPosts(): Promise<PostListItem[]> {
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .orderBy(desc(posts.updatedAt));
  return rows;
}

function toIsoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function getPostForEdit(id: string): Promise<PostEditData | null> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
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
    id: post.id,
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

/** For the media library's usage view later, if wired: does a post use an asset? */
export function isPostCover(post: Pick<Post, "coverImageAssetId">, assetId: string): boolean {
  return post.coverImageAssetId === assetId;
}
