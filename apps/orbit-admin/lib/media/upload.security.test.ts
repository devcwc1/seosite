import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { UploadError } from "@/lib/media/errors";
import { processUpload } from "@/lib/media/process";
import { deleteStored, readStored } from "@/lib/media/storage";

const createdIds: string[] = [];

async function makeImageFile(opts: {
  format: "png" | "jpeg" | "webp";
  width: number;
  height: number;
  name?: string;
  type?: string;
  extra?: Uint8Array;
}): Promise<File> {
  const base = sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 3,
      background: { r: 40, g: 90, b: 200 },
    },
  });
  const encoded =
    opts.format === "png"
      ? await base.png().toBuffer()
      : opts.format === "jpeg"
        ? await base.jpeg().toBuffer()
        : await base.webp().toBuffer();
  const bytes = opts.extra
    ? Buffer.concat([encoded, Buffer.from(opts.extra)])
    : encoded;
  const type =
    opts.type ??
    (opts.format === "jpeg"
      ? "image/jpeg"
      : opts.format === "png"
        ? "image/png"
        : "image/webp");
  const ext = opts.format === "jpeg" ? "jpg" : opts.format;
  return new File([new Uint8Array(bytes)], opts.name ?? `test.${ext}`, { type });
}

async function upload(file: File) {
  const result = await processUpload(file, null);
  createdIds.push(result.asset.id);
  return result;
}

afterAll(async () => {
  for (const id of createdIds) {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    if (row?.storageKey) await deleteStored(row.storageKey);
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }
  await pool.end();
});

describe("ORB-501 upload security (integration)", () => {
  it("accepts a valid PNG and re-encodes it to WebP", async () => {
    const r = await upload(
      await makeImageFile({ format: "png", width: 300, height: 300 }),
    );
    expect(r.alreadyInLibrary).toBe(false);
    expect(r.asset.mimeType).toBe("image/webp");
    expect(r.asset.width).toBe(300);
    expect(r.asset.height).toBe(300);
  });

  it("dedupes identical bytes without creating a new row", async () => {
    const bytes = new Uint8Array(
      await (
        await makeImageFile({ format: "png", width: 256, height: 256 })
      ).arrayBuffer(),
    );
    const first = await upload(
      new File([bytes], "a.png", { type: "image/png" }),
    );
    const before = (await db.select().from(mediaAssets)).length;
    const second = await processUpload(
      new File([bytes], "b.png", { type: "image/png" }),
      null,
    );
    const after = (await db.select().from(mediaAssets)).length;

    expect(second.alreadyInLibrary).toBe(true);
    expect(second.asset.id).toBe(first.asset.id);
    expect(after).toBe(before);
  });

  it("rejects a PDF renamed .jpg (magic-byte mismatch)", async () => {
    const pdf = new File(
      [new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj trailer")],
      "evil.jpg",
      { type: "image/jpeg" },
    );
    await expect(processUpload(pdf, null)).rejects.toMatchObject({
      code: "unsupported_type",
    });
  });

  it("rejects PNG bytes carrying a .jpg extension (extension mismatch)", async () => {
    const f = await makeImageFile({
      format: "png",
      width: 300,
      height: 300,
      name: "mismatch.jpg",
      type: "image/jpeg",
    });
    await expect(processUpload(f, null)).rejects.toMatchObject({
      code: "type_mismatch",
    });
  });

  it("rejects SVG", async () => {
    const svg = new File(
      [
        new TextEncoder().encode(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>',
        ),
      ],
      "x.svg",
      { type: "image/svg+xml" },
    );
    await expect(processUpload(svg, null)).rejects.toMatchObject({
      code: "svg_rejected",
    });
  });

  it("rejects oversize files (>15 MB)", async () => {
    const big = new File([new Uint8Array(16 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    await expect(processUpload(big, null)).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("rejects out-of-bounds dimensions", async () => {
    await expect(
      processUpload(
        await makeImageFile({ format: "png", width: 100, height: 100 }),
        null,
      ),
    ).rejects.toMatchObject({ code: "dimensions_out_of_bounds" });

    await expect(
      processUpload(
        await makeImageFile({ format: "png", width: 8001, height: 300 }),
        null,
      ),
    ).rejects.toMatchObject({ code: "dimensions_out_of_bounds" });
  });

  it("strips an appended payload via re-encode", async () => {
    const marker = new TextEncoder().encode("PAYLOAD_MARKER_ORB501");
    const r = await upload(
      await makeImageFile({
        format: "jpeg",
        width: 300,
        height: 300,
        extra: marker,
      }),
    );
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, r.asset.id))
      .limit(1);
    expect(row?.storageKey).toBeTruthy();
    const stored = await readStored(row!.storageKey!);
    expect(stored.includes(Buffer.from(marker))).toBe(false);
    expect(r.asset.mimeType).toBe("image/webp");
  });

  it("throws typed UploadError instances", async () => {
    const svg = new File([new TextEncoder().encode("<svg></svg>____")], "a.svg", {
      type: "image/svg+xml",
    });
    await expect(processUpload(svg, null)).rejects.toBeInstanceOf(UploadError);
  });
});
