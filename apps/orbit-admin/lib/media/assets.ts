import "server-only";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { productsCollection } from "@/lib/db/mongo-collections";
import { mediaAssets, users, type MediaAsset } from "@/lib/db/schema";

import { referencedAssetIds, usageCounts, usageForAsset } from "./usage";
import type {
  MediaAssetDetailDTO,
  MediaAssetDTO,
  MediaListDTO,
  MediaUsageFilter,
  ProductMediaItemDTO,
} from "./types";

/** Served URL for an asset — external URL for backfilled images, else our route. */
export function assetUrl(asset: Pick<MediaAsset, "id" | "externalUrl">): string {
  return asset.externalUrl ?? `/api/v1/media/file/${asset.id}`;
}

/**
 * URL for the grid-sized copy. External backfills have no thumbnail of ours,
 * and neither do assets uploaded before thumbnails existed — both fall back
 * to the full-size URL rather than making every caller check.
 */
export function assetThumbUrl(
  asset: Pick<MediaAsset, "id" | "externalUrl" | "thumbKey">,
): string {
  if (asset.externalUrl || !asset.thumbKey) return assetUrl(asset);
  return `/api/v1/media/file/${asset.id}?variant=thumb`;
}

export function toAssetDTO(asset: MediaAsset, usageCount = 0): MediaAssetDTO {
  return {
    id: asset.id,
    url: assetUrl(asset),
    thumbUrl: assetThumbUrl(asset),
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    mimeType: asset.mimeType,
    format: asset.format,
    originalName: asset.originalName,
    title: asset.title,
    alt: asset.alt,
    createdAt: asset.createdAt.toISOString(),
    usageCount,
  };
}

export type ListAssetsOptions = {
  query?: string;
  usage?: MediaUsageFilter;
  /** Page size. Capped so a hand-written request cannot ask for everything. */
  limit?: number;
  /** `createdAt` ISO string of the last item on the previous page. */
  cursor?: string;
};

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;

/**
 * A page of the library — ORB-505.
 *
 * Keyset paging on `createdAt` rather than OFFSET: the library is sorted
 * newest first and gets uploaded to while someone is paging through it, and
 * an offset would silently skip or repeat a row every time that happens.
 */
export async function listAssets(
  options: ListAssetsOptions = {},
): Promise<MediaListDTO> {
  const q = options.query?.trim();
  const usage = options.usage ?? "all";
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const filters = [
    // Soft-deleted assets are gone as far as the library is concerned.
    isNull(mediaAssets.deletedAt),
  ];

  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ilike(mediaAssets.originalName, like),
        ilike(mediaAssets.title, like),
        ilike(mediaAssets.alt, like),
      )!,
    );
  }

  if (usage !== "all") {
    const referenced = [...(await referencedAssetIds())];
    if (usage === "used") {
      // Nothing is referenced, so nothing can match.
      if (referenced.length === 0) return { items: [], nextCursor: null, total: 0 };
      filters.push(inArray(mediaAssets.id, referenced));
    } else if (referenced.length > 0) {
      filters.push(notInArray(mediaAssets.id, referenced));
    }
  }

  const where = and(...filters);

  const totals = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(mediaAssets)
    .where(where);
  const total = totals[0]?.total ?? 0;

  // One extra row tells us whether another page exists without a second query.
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      options.cursor
        ? and(where, lt(mediaAssets.createdAt, new Date(options.cursor)))
        : where,
    )
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const counts = await usageCounts(page.map((row) => row.id));

  return {
    items: page.map((row) => toAssetDTO(row, counts.get(row.id) ?? 0)),
    nextCursor:
      rows.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    total,
  };
}

/**
 * One asset with everything the detail drawer shows, including where it is
 * used. Soft-deleted assets resolve to null: the drawer is part of the
 * library, and the library does not have them.
 */
export async function getAssetDetail(
  id: string,
): Promise<MediaAssetDetailDTO | null> {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!row) return null;

  const [usage, uploader] = await Promise.all([
    usageForAsset(id),
    row.uploadedBy
      ? db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, row.uploadedBy))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...toAssetDTO(row, usage.length),
    originalMimeType: row.originalMimeType,
    // Null when the uploader's account is gone — the asset outlives them.
    uploadedByEmail: uploader[0]?.email ?? null,
    usage,
  };
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
  // Galleries and OG references both count. Checking only product_media
  // would let an asset be deleted while a product page still points at it.
  const usage = await usageForAsset(id);
  if (usage.length > 0) {
    return { ok: false, error: "This image is used by one or more products." };
  }

  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!row) return { ok: false, error: "Not found." };

  // Soft delete: the row and the file stay. Dedupe is by sha256, so a hard
  // delete would leave a re-upload of the same bytes colliding with nothing,
  // while the audit trail still referenced an id that no longer resolved.
  // The stored file is kept deliberately — reclaiming it is a separate,
  // deliberate sweep, not a side effect of one person clicking delete.
  await db
    .update(mediaAssets)
    .set({ deletedAt: new Date() })
    .where(eq(mediaAssets.id, id));

  await recordAudit({
    actorId,
    action: "media.deleted",
    target: `media_asset:${id}`,
    metadata: { sha256: row.sha256 },
  });

  return { ok: true };
}

/* --------------------------- product galleries --------------------------- */

/**
 * A product's gallery, resolved for display. The ordered refs live on the
 * product document (`media`); the asset metadata (URL, dimensions, fallback
 * alt) is still read from Postgres media_assets. An asset that has since gone
 * is skipped rather than rendered broken.
 */
export async function getProductGallery(
  productId: string,
): Promise<ProductMediaItemDTO[]> {
  const doc = await productsCollection().findOne(
    { _id: productId },
    { projection: { media: 1 } },
  );
  const media = doc?.media ?? [];
  if (media.length === 0) return [];

  const assetRows = await db
    .select({
      id: mediaAssets.id,
      externalUrl: mediaAssets.externalUrl,
      alt: mediaAssets.alt,
      width: mediaAssets.width,
      height: mediaAssets.height,
    })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, media.map((m) => m.mediaAssetId)));
  const byId = new Map(assetRows.map((a) => [a.id, a]));

  return [...media]
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => {
      const asset = byId.get(m.mediaAssetId);
      if (!asset) return [];
      return [
        {
          assetId: m.mediaAssetId,
          url: asset.externalUrl ?? `/api/v1/media/file/${m.mediaAssetId}`,
          alt: m.alt ?? asset.alt,
          width: asset.width,
          height: asset.height,
          position: m.position,
        },
      ];
    });
}

/** Append an asset to a product's gallery at the next position (idempotent). */
export async function linkAssetToProduct(
  productId: string,
  assetId: string,
): Promise<void> {
  const doc = await productsCollection().findOne(
    { _id: productId },
    { projection: { media: 1 } },
  );
  if (!doc) return;
  if (doc.media.some((m) => m.mediaAssetId === assetId)) return;

  const nextPosition =
    doc.media.reduce((max, m) => Math.max(max, m.position), -1) + 1;

  await productsCollection().updateOne(
    { _id: productId },
    {
      $push: { media: { mediaAssetId: assetId, position: nextPosition, alt: null } },
      $set: { updatedAt: new Date() },
    },
  );
}

/** Remove a single asset from a product's gallery (idempotent). */
export async function unlinkAssetFromProduct(
  productId: string,
  assetId: string,
): Promise<void> {
  await productsCollection().updateOne(
    { _id: productId },
    { $pull: { media: { mediaAssetId: assetId } }, $set: { updatedAt: new Date() } },
  );
}
