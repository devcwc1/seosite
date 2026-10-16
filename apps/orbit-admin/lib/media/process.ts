import "server-only";

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import sharp from "sharp";

import { recordAudit } from "@/lib/audit";
import {
  mediaAssetsCollection,
  type MediaAssetDoc,
} from "@/lib/db/mongo-collections";

import { docToAssetView, type MediaAssetView } from "./asset-view";

import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_DIMENSION,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  MIN_DIMENSION,
  OUTPUT_MIME,
  THUMB_MAX_EDGE,
  THUMB_QUALITY,
  WEBP_QUALITY,
  type AllowedFormat,
} from "./constants";
import { UploadError } from "./errors";
import { sniffImageFormat } from "./sniff";
import {
  buildStorageKey,
  buildThumbKey,
  deleteStored,
  writeAtomic,
} from "./storage";

export type ProcessResult = { asset: MediaAssetView; alreadyInLibrary: boolean };

async function findBySha(sha256: string): Promise<MediaAssetView | undefined> {
  const doc = await mediaAssetsCollection().findOne({ sha256 });
  return doc ? docToAssetView(doc) : undefined;
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
  if (existing) {
    // Uploading bytes that match a soft-deleted asset restores it. Without
    // this the uploader is told the image is already in the library and then
    // cannot find it anywhere — dedupe would have matched a row the library
    // hides, and there would be no way to get the image back.
    if (existing.deletedAt) {
      await mediaAssetsCollection().updateOne(
        { _id: existing.id },
        { $set: { deletedAt: null } },
      );
      return { asset: { ...existing, deletedAt: null }, alreadyInLibrary: false };
    }
    return { asset: existing, alreadyInLibrary: true };
  }

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

  // 6. A downscaled copy for grid cells. Generated from the re-encoded
  //    output, not the upload, so it inherits the same neutralisation.
  //    A thumbnail is a convenience: if sharp cannot produce one the upload
  //    still succeeds and the grid falls back to the original.
  let thumb: Buffer | null = null;
  try {
    thumb = await sharp(output)
      .resize({
        width: THUMB_MAX_EDGE,
        height: THUMB_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch {
    thumb = null;
  }

  // 7. Content-addressed atomic write.
  const storageKey = buildStorageKey(sha256);
  await writeAtomic(storageKey, output);

  const thumbKey = thumb ? buildThumbKey(storageKey) : null;
  if (thumb && thumbKey) await writeAtomic(thumbKey, thumb);

  // 8. Persist. On a sha256 race, clean up our file and return the winner.
  const doc: MediaAssetDoc = {
    _id: randomUUID(),
    sha256,
    storageKey,
    externalUrl: null,
    thumbKey,
    format: "webp",
    mimeType: OUTPUT_MIME,
    width: outWidth,
    height: outHeight,
    sizeBytes: output.length,
    originalName: file.name || null,
    originalMimeType: declaredMime || null,
    title: null,
    alt: null,
    deletedAt: null,
    uploadedBy: actorId,
    createdAt: new Date(),
  };

  try {
    await mediaAssetsCollection().insertOne(doc);

    await recordAudit({
      actorId,
      action: "media.uploaded",
      target: `media_asset:${doc._id}`,
      metadata: { sha256, sizeBytes: output.length, width: outWidth, height: outHeight },
    });

    return { asset: docToAssetView(doc), alreadyInLibrary: false };
  } catch (error) {
    await deleteStored(storageKey);
    const winner = await findBySha(sha256);
    if (winner) return { asset: winner, alreadyInLibrary: true };
    throw error;
  }
}
