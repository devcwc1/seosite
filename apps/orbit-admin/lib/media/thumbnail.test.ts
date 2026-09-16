import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { THUMB_MAX_EDGE } from "@/lib/media/constants";
import { processUpload } from "@/lib/media/process";
import { deleteStored, readStored } from "@/lib/media/storage";

import { assetThumbUrl, toAssetDTO } from "./assets";

/**
 * Grid cells used to load the full-size original — an 8000px upload behind a
 * 300px tile. These cover the downscaled copy that replaces it.
 */

const created: string[] = [];

/** A real, distinct image so dedupe does not collapse the fixtures. */
async function upload(name: string, size: number) {
  const png = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: (size * 7) % 255, g: 40, b: 90 },
    },
  })
    .png()
    .toBuffer();

  const file = new File([new Uint8Array(png)], `${name}.png`, {
    type: "image/png",
  });
  const result = await processUpload(file, null);
  created.push(result.asset.id);
  return result.asset;
}

afterAll(async () => {
  for (const id of created) {
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    if (row?.storageKey) await deleteStored(row.storageKey);
    if (row?.thumbKey) await deleteStored(row.thumbKey);
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }
  await pool.end();
});

describe("thumbnails", () => {
  it("writes a downscaled copy beside the original", async () => {
    const asset = await upload("thumb-large", 1200);

    expect(asset.thumbKey).toBeTruthy();

    const thumb = await sharp(await readStored(asset.thumbKey!)).metadata();
    expect(Math.max(thumb.width ?? 0, thumb.height ?? 0)).toBe(THUMB_MAX_EDGE);
  });

  it("makes the thumbnail smaller than the original", async () => {
    // The entire point: a grid of a hundred cells should not download a
    // hundred full-size uploads.
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, created[0]!));

    const original = await readStored(row!.storageKey!);
    const thumb = await readStored(row!.thumbKey!);

    expect(thumb.byteLength).toBeLessThan(original.byteLength);
  });

  it("never enlarges an image that is already small", async () => {
    const asset = await upload("thumb-small", 220);

    const thumb = await sharp(await readStored(asset.thumbKey!)).metadata();
    expect(thumb.width).toBe(220);
  });

  it("points the DTO at the thumbnail", async () => {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, created[0]!));

    expect(toAssetDTO(row!).thumbUrl).toBe(
      `/api/v1/media/file/${row!.id}?variant=thumb`,
    );
  });

  it("falls back to the original when an asset has no thumbnail", async () => {
    // Assets uploaded before thumbnails existed, and external backfills.
    // Callers should never have to check which kind they are holding.
    expect(
      assetThumbUrl({ id: "abc", externalUrl: null, thumbKey: null }),
    ).toBe("/api/v1/media/file/abc");

    expect(
      assetThumbUrl({
        id: "abc",
        externalUrl: "https://example.test/x.jpg",
        thumbKey: "products/aa/bb/x.thumb.webp",
      }),
    ).toBe("https://example.test/x.jpg");
  });
});
