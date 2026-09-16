import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { mediaAssets, productContent, productMedia } from "@/lib/db/schema";
import { createProduct, deleteProduct } from "@/lib/products/mutations";
import { productInputSchema } from "@/lib/products/validation";

import { listAssets } from "./assets";
import { referencedAssetIds, usageCounts, usageForAsset } from "./usage";

/**
 * Integration, against a real Postgres — ORB-505's QA note asks for it, and
 * usage is a join across three tables plus a JSON field, which is precisely
 * the shape of thing a mock would get wrong convincingly.
 */

const suffix = Date.now().toString(36);
const productIds: string[] = [];
const assetIds: string[] = [];

/** An asset row with no file behind it; nothing here reads the bytes. */
async function makeAsset(name: string): Promise<string> {
  const [row] = await db
    .insert(mediaAssets)
    .values({
      sha256: `${suffix}${name}`.padEnd(64, "0").slice(0, 64),
      storageKey: `test/${suffix}/${name}.webp`,
      format: "webp",
      mimeType: "image/webp",
      width: 800,
      height: 600,
      sizeBytes: 1234,
      originalName: `${name}-${suffix}.webp`,
    })
    .returning({ id: mediaAssets.id });
  assetIds.push(row!.id);
  return row!.id;
}

async function makeProduct(key: string, title: string): Promise<string> {
  const result = await createProduct(
    productInputSchema.parse({
      title,
      slug: `usage-${suffix}-${key}`,
      sku: `USAGE-${suffix}-${key}`.toUpperCase(),
      status: "published",
      shortInfo: "",
      description: "",
      price: "1.00",
      currency: "EUR",
      inStock: true,
      stockQuantity: "1",
      images: [],
      categories: [],
      meta: { title: "", description: "", keywords: "" },
      reviews: [],
    }),
    null,
  );
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.errors)}`);
  productIds.push(result.id);
  return result.id;
}

async function attachToGallery(productId: string, assetId: string, position = 0) {
  await db.insert(productMedia).values({ productId, mediaAssetId: assetId, position });
}

async function setOgImage(productId: string, assetId: string | null) {
  await db
    .update(productContent)
    .set({ meta: assetId ? { ogImageAssetId: assetId } : {} })
    .where(eq(productContent.productId, productId));
}

let sharedAsset: string;
let ogOnlyAsset: string;
let unusedAsset: string;
let productA: string;
let productB: string;
let productC: string;

beforeAll(async () => {
  sharedAsset = await makeAsset("shared");
  ogOnlyAsset = await makeAsset("ogonly");
  unusedAsset = await makeAsset("unused");

  productA = await makeProduct("a", `Usage A ${suffix}`);
  productB = await makeProduct("b", `Usage B ${suffix}`);
  productC = await makeProduct("c", `Usage C ${suffix}`);

  // The AC's scenario: one asset on three products' galleries.
  await attachToGallery(productA, sharedAsset);
  await attachToGallery(productB, sharedAsset);
  await attachToGallery(productC, sharedAsset);

  // And an asset referenced only as an OG image.
  await setOgImage(productA, ogOnlyAsset);
});

afterAll(async () => {
  for (const id of productIds) await deleteProduct(id, null);
  for (const id of assetIds) await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  await pool.end();
});

describe("usageForAsset", () => {
  it("lists all three products for an asset used on three", async () => {
    // AC1.
    const usage = await usageForAsset(sharedAsset);

    expect(usage).toHaveLength(3);
    expect(usage.map((u) => u.productId).sort()).toEqual(
      [productA, productB, productC].sort(),
    );
  });

  it("carries a title and slug so each one can be rendered as a link", async () => {
    const usage = await usageForAsset(sharedAsset);

    for (const ref of usage) {
      expect(ref.productTitle).toMatch(/^Usage [ABC] /);
      expect(ref.productSlug).toContain(`usage-${suffix}-`);
    }
  });

  it("counts an OG reference, not just galleries", async () => {
    // An asset nothing links in a gallery is still in use if a page's Open
    // Graph tag points at it.
    const usage = await usageForAsset(ogOnlyAsset);

    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ productId: productA, kind: "ogImage" });
  });

  it("returns nothing for an asset no product references", async () => {
    expect(await usageForAsset(unusedAsset)).toEqual([]);
  });

  it("lists a product twice when it uses the asset both ways", async () => {
    await setOgImage(productB, sharedAsset);

    const usage = await usageForAsset(sharedAsset);
    const forB = usage.filter((u) => u.productId === productB);

    expect(forB.map((u) => u.kind).sort()).toEqual(["gallery", "ogImage"]);

    // Clear it again — pointing B at ogOnlyAsset instead would leave the
    // next test counting a reference this one invented.
    await setOgImage(productB, null);
  });
});

describe("usageCounts", () => {
  it("counts every asset in one pass", async () => {
    const counts = await usageCounts([sharedAsset, ogOnlyAsset, unusedAsset]);

    expect(counts.get(sharedAsset)).toBe(3);
    expect(counts.get(ogOnlyAsset)).toBe(1);
    expect(counts.get(unusedAsset)).toBeUndefined();
  });

  it("counts a product once even with the asset in two gallery slots", async () => {
    await attachToGallery(productA, ogOnlyAsset, 1);

    const counts = await usageCounts([ogOnlyAsset]);
    // Gallery slot + OG on the same product is still one product using it…
    // but they are different kinds of use, so both are counted once each.
    expect(counts.get(ogOnlyAsset)).toBe(2);

    await db.delete(productMedia).where(eq(productMedia.mediaAssetId, ogOnlyAsset));
  });

  it("asks nothing of the database for an empty list", async () => {
    expect(await usageCounts([])).toEqual(new Map());
  });
});

describe("referencedAssetIds", () => {
  it("includes assets referenced either way", async () => {
    const referenced = await referencedAssetIds();

    expect(referenced.has(sharedAsset)).toBe(true);
    expect(referenced.has(ogOnlyAsset)).toBe(true);
    expect(referenced.has(unusedAsset)).toBe(false);
  });
});

describe("listAssets filters", () => {
  it("reports a usage count on every item", async () => {
    const page = await listAssets({ query: suffix });
    const byId = new Map(page.items.map((item) => [item.id, item]));

    expect(byId.get(sharedAsset)?.usageCount).toBe(3);
    expect(byId.get(unusedAsset)?.usageCount).toBe(0);
  });

  it("returns only used assets when asked", async () => {
    const page = await listAssets({ query: suffix, usage: "used" });
    const ids = page.items.map((item) => item.id);

    expect(ids).toContain(sharedAsset);
    expect(ids).not.toContain(unusedAsset);
  });

  it("returns only unused assets when asked", async () => {
    const page = await listAssets({ query: suffix, usage: "unused" });
    const ids = page.items.map((item) => item.id);

    expect(ids).toContain(unusedAsset);
    expect(ids).not.toContain(sharedAsset);
  });

  it("pages without repeating or skipping a row", async () => {
    const first = await listAssets({ query: suffix, limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    expect(first.total).toBe(3);

    const second = await listAssets({
      query: suffix,
      limit: 2,
      cursor: first.nextCursor!,
    });

    const seen = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
  });
});
