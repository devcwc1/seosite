import "server-only";

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  mediaAssets,
  productMedia,
  type MediaAsset,
} from "@/lib/db/schema";

import { deleteStored } from "./storage";
import type { MediaAssetDTO, ProductMediaItemDTO } from "./types";

/** Served URL for an asset — external URL for backfilled images, else our route. */
export function assetUrl(asset: Pick<MediaAsset, "id" | "externalUrl">): string {
  return asset.externalUrl ?? `/api/v1/media/file/${asset.id}`;
}

export function toAssetDTO(asset: MediaAsset): MediaAssetDTO {
  return {
    id: asset.id,
    url: assetUrl(asset),
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    mimeType: asset.mimeType,
    format: asset.format,
    originalName: asset.originalName,
    title: asset.title,
    alt: asset.alt,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function listAssets(query?: string): Promise<MediaAssetDTO[]> {
  const q = query?.trim();
  const rows = q
    ? await db
        .select()
        .from(mediaAssets)
        .where(
          or(
            ilike(mediaAssets.originalName, `%${q}%`),
            ilike(mediaAssets.title, `%${q}%`),
            ilike(mediaAssets.alt, `%${q}%`),
          ),
        )
        .orderBy(desc(mediaAssets.createdAt))
        .limit(300)
    : await db
        .select()
        .from(mediaAssets)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(300);
  return rows.map(toAssetDTO);
}

export type UpdateAssetInput = {
  title?: string | null;
  alt?: string | null;
};

export type UpdateAssetResult =
  | { ok: true; asset: MediaAssetDTO }
  | { ok: false; error: string };

/** Update the editable metadata (title, alt) of a media asset. */
export async function updateAsset(
  id: string,
  input: UpdateAssetInput,
  actorId: string | null,
): Promise<UpdateAssetResult> {
  const patch: Partial<Pick<MediaAsset, "title" | "alt">> = {};
  if (input.title !== undefined) {
    const t = input.title?.trim();
    patch.title = t ? t : null;
  }
  if (input.alt !== undefined) {
    const a = input.alt?.trim();
    patch.alt = a ? a : null;
  }

  if (Object.keys(patch).length === 0) {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    if (!row) return { ok: false, error: "Not found." };
    return { ok: true, asset: toAssetDTO(row) };
  }

  const [row] = await db
    .update(mediaAssets)
    .set(patch)
    .where(eq(mediaAssets.id, id))
    .returning();
  if (!row) return { ok: false, error: "Not found." };

  await recordAudit({
    actorId,
    action: "media.updated",
    target: `media_asset:${id}`,
    metadata: { fields: Object.keys(patch) },
  });

  return { ok: true, asset: toAssetDTO(row) };
}

export type DeleteAssetResult = { ok: boolean; error?: string };

/** Delete an asset (row + file). Blocked while it's linked to any product. */
export async function deleteAsset(
  id: string,
  actorId: string | null,
): Promise<DeleteAssetResult> {
  const [link] = await db
    .select({ id: productMedia.id })
    .from(productMedia)
    .where(eq(productMedia.mediaAssetId, id))
    .limit(1);
  if (link) {
    return { ok: false, error: "This image is used by one or more products." };
  }

  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  if (!row) return { ok: false, error: "Not found." };

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  if (row.storageKey) await deleteStored(row.storageKey);

  await recordAudit({
    actorId,
    action: "media.deleted",
    target: `media_asset:${id}`,
    metadata: { sha256: row.sha256 },
  });

  return { ok: true };
}

/* --------------------------- product galleries --------------------------- */

export async function getProductGallery(
  productId: string,
): Promise<ProductMediaItemDTO[]> {
  const rows = await db
    .select({
      assetId: mediaAssets.id,
      externalUrl: mediaAssets.externalUrl,
      linkAlt: productMedia.alt,
      assetAlt: mediaAssets.alt,
      width: mediaAssets.width,
      height: mediaAssets.height,
      position: productMedia.position,
    })
    .from(productMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaAssetId))
    .where(eq(productMedia.productId, productId))
    .orderBy(asc(productMedia.position));

  return rows.map((r) => ({
    assetId: r.assetId,
    url: r.externalUrl ?? `/api/v1/media/file/${r.assetId}`,
    alt: r.linkAlt ?? r.assetAlt,
    width: r.width,
    height: r.height,
    position: r.position,
  }));
}

/** Append an asset to a product's gallery at the next position (idempotent). */
export async function linkAssetToProduct(
  productId: string,
  assetId: string,
): Promise<void> {
  const rows = await db
    .select({ max: sql<number>`coalesce(max(${productMedia.position}), -1)` })
    .from(productMedia)
    .where(eq(productMedia.productId, productId));
  const nextPosition = (rows[0]?.max ?? -1) + 1;

  await db
    .insert(productMedia)
    .values({ productId, mediaAssetId: assetId, position: nextPosition })
    .onConflictDoNothing();
}

/** Remove a single asset from a product's gallery (idempotent). */
export async function unlinkAssetFromProduct(
  productId: string,
  assetId: string,
): Promise<void> {
  await db
    .delete(productMedia)
    .where(
      and(
        eq(productMedia.productId, productId),
        eq(productMedia.mediaAssetId, assetId),
      ),
    );
}

/**
 * Replace a product's gallery with the given ordered asset ids. Runs inside the
 * caller's transaction so it stays consistent with the product write.
 */
export async function setProductGallery(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  items: { assetId: string; alt?: string | null }[],
): Promise<void> {
  await tx.delete(productMedia).where(eq(productMedia.productId, productId));
  if (items.length > 0) {
    await tx.insert(productMedia).values(
      items.map((it, index) => ({
        productId,
        mediaAssetId: it.assetId,
        position: index,
        alt: it.alt ?? null,
      })),
    );
  }
}
