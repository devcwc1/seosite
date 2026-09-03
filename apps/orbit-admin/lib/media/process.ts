import "server-only";

import { createHash } from "node:crypto";
import path from "node:path";

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { mediaAssets, type MediaAsset } from "@/lib/db/schema";

import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_DIMENSION,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  MIN_DIMENSION,
  OUTPUT_MIME,
  WEBP_QUALITY,
  type AllowedFormat,
} from "./constants";
import { UploadError } from "./errors";
import { sniffImageFormat } from "./sniff";
import { buildStorageKey, deleteStored, writeAtomic } from "./storage";

export type ProcessResult = { asset: MediaAsset; alreadyInLibrary: boolean };

async function findBySha(sha256: string): Promise<MediaAsset | undefined> {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.sha256, sha256))
    .limit(1);
  return row;
}

/**
 * The full ORB-501 intake pipeline. Validation and re-encoding happen entirely
 * in memory; nothing touches disk or the DB until an asset is known-good, so a
 * rejection can never leave an orphan row or file.
 */
export async function processUpload(
  file: File,
  actorId: string | null,
): Promise<ProcessResult> {
  if (file.size === 0) {
    throw new UploadError("empty", "The file is empty.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("too_large", "Maximum upload size is 15 MB.", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadError("too_large", "Maximum upload size is 15 MB.", 413);
  }

  // 1. Magic-byte sniffing.
  const sniffed = sniffImageFormat(buffer);
  if (sniffed === "svg") {
    throw new UploadError("svg_rejected", "SVG images are not allowed.", 415);
  }
  if (sniffed === "unknown") {
    throw new UploadError(
      "unsupported_type",
      "Unsupported or unrecognized image format.",
      415,
    );
  }
  const detected: AllowedFormat = sniffed;

  // 2. Declared MIME + extension must agree with the sniffed bytes.
  const declaredMime = (file.type || "").toLowerCase();
  const ext = path.extname(file.name || "").toLowerCase();
  const mimeOk =
    declaredMime === "" || ALLOWED_MIME_TYPES[detected].includes(declaredMime);
  const extOk = ext === "" || ALLOWED_EXTENSIONS[detected].includes(ext);
  if (!mimeOk || !extOk) {
    throw new UploadError(
      "type_mismatch",
      "The file's declared type or extension does not match its contents.",
      415,
    );
  }

  // 3. Dedupe on the original bytes.
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const existing = await findBySha(sha256);
  if (existing) return { asset: existing, alreadyInLibrary: true };

  // 4. Decode with sharp (real parse) + decompression-bomb guard.
  let width: number;
  let height: number;
  try {
    const meta = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
    if (meta.format !== detected) {
      throw new UploadError(
        "type_mismatch",
        "Image contents do not match the detected format.",
        415,
      );
    }
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("not_an_image", "The file is not a valid image.", 415);
  }

  if (
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new UploadError(
      "dimensions_out_of_bounds",
      `Image must be ${MIN_DIMENSION}–${MAX_DIMENSION}px on each side.`,
      422,
    );
  }

  // 5. Re-encode to WebP — this strips EXIF/metadata and any appended payload.
  let output: Buffer;
  try {
    output = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate() // bake in EXIF orientation before metadata is dropped
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new UploadError(
      "not_an_image",
      "The image could not be processed.",
      415,
    );
  }
  const outMeta = await sharp(output).metadata();
  const outWidth = outMeta.width ?? width;
  const outHeight = outMeta.height ?? height;

  // 6. Content-addressed atomic write.
  const storageKey = buildStorageKey(sha256);
  await writeAtomic(storageKey, output);

  // 7. Persist. On a sha256 race, clean up our file and return the winner.
  try {
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        sha256,
        storageKey,
        format: "webp",
        mimeType: OUTPUT_MIME,
        width: outWidth,
        height: outHeight,
        sizeBytes: output.length,
        originalName: file.name || null,
        originalMimeType: declaredMime || null,
        uploadedBy: actorId,
      })
      .returning();
    if (!asset) throw new Error("media_assets insert returned no row");

    await recordAudit({
      actorId,
      action: "media.uploaded",
      target: `media_asset:${asset.id}`,
      metadata: { sha256, sizeBytes: output.length, width: outWidth, height: outHeight },
    });

    return { asset, alreadyInLibrary: false };
  } catch (error) {
    await deleteStored(storageKey);
    const winner = await findBySha(sha256);
    if (winner) return { asset: winner, alreadyInLibrary: true };
    throw error;
  }
}
