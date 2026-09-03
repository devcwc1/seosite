import "dotenv/config";

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { db, pool } from "../lib/db";
import {
  mediaAssets,
  productContent,
  productMedia,
} from "../lib/db/schema";
import { logger } from "../lib/logger";

const log = logger.child({ script: "backfill-media" });

function guessMime(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".avif")) return "image/avif";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Register a pre-existing external image URL as a media_asset (without
 * re-hosting). Deduped on a synthetic sha256 of the URL so re-running is safe.
 */
async function ensureExternalAsset(
  url: string,
  alt: string | null,
): Promise<string | null> {
  const sha = createHash("sha256").update(`external:${url}`).digest("hex");

  const [existing] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(eq(mediaAssets.sha256, sha))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(mediaAssets)
    .values({
      sha256: sha,
      storageKey: null,
      externalUrl: url,
      format: "external",
      mimeType: guessMime(url),
      width: 0,
      height: 0,
      sizeBytes: 0,
      alt,
    })
    .onConflictDoNothing({ target: mediaAssets.sha256 })
    .returning({ id: mediaAssets.id });
  if (row) return row.id;

  const [after] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(eq(mediaAssets.sha256, sha))
    .limit(1);
  return after?.id ?? null;
}

async function backfill(): Promise<void> {
  const contents = await db
    .select({
      productId: productContent.productId,
      images: productContent.images,
    })
    .from(productContent);

  let linked = 0;
  let skipped = 0;
  let productsTouched = 0;

  for (const content of contents) {
    // Don't touch products that already have a product_media gallery.
    const [hasLink] = await db
      .select({ id: productMedia.id })
      .from(productMedia)
      .where(eq(productMedia.productId, content.productId))
      .limit(1);
    if (hasLink) continue;

    const images = (content.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    if (images.length === 0) continue;

    let position = 0;
    let touched = false;
    for (const img of images) {
      if (img.url.startsWith("/api/uploads/")) {
        // Legacy local uploads were removed with the old media system.
        log.warn({ url: img.url }, "Skipping removed legacy local upload");
        skipped += 1;
        continue;
      }
      if (!/^https?:\/\//i.test(img.url)) {
        skipped += 1;
        continue;
      }

      const assetId = await ensureExternalAsset(img.url, img.alt ?? null);
      if (!assetId) {
        skipped += 1;
        continue;
      }

      await db
        .insert(productMedia)
        .values({
          productId: content.productId,
          mediaAssetId: assetId,
          position,
          alt: img.alt ?? null,
        })
        .onConflictDoNothing();
      position += 1;
      linked += 1;
      touched = true;
    }
    if (touched) productsTouched += 1;
  }

  log.info({ linked, skipped, productsTouched }, "Backfill complete");
}

backfill()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    log.error({ err: error }, "Backfill failed");
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
