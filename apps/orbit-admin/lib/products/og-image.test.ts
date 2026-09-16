import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { deleteAsset } from "@/lib/media/assets";
import { usageForAsset } from "@/lib/media/usage";

import {
  createProduct,
  deleteProduct,
  getProductForEdit,
  updateProduct,
} from "./mutations";
import { productInputSchema, type ProductParsed } from "./validation";

/**
 * ORB-505 AC2: picking an asset in pick-mode from the OG image field sets
 * seo.ogImageAssetId to that asset. The picker hands the form an id; these
 * tests cover everything from the form's payload onward.
 */

const suffix = Date.now().toString(36);
const productIds: string[] = [];
const assetIds: string[] = [];

async function makeAsset(name: string): Promise<string> {
  const [row] = await db
    .insert(mediaAssets)
    .values({
      sha256: `og${suffix}${name}`.padEnd(64, "0").slice(0, 64),
      storageKey: `test/${suffix}/${name}.webp`,
      format: "webp",
      mimeType: "image/webp",
      width: 1200,
      height: 630,
      sizeBytes: 4242,
      originalName: `og-${suffix}-${name}.webp`,
    })
    .returning({ id: mediaAssets.id });
  assetIds.push(row!.id);
  return row!.id;
}

function input(ogImageAssetId: string, key: string): ProductParsed {
  return productInputSchema.parse({
    title: `OG ${key} ${suffix}`,
    slug: `og-${suffix}-${key}`,
    sku: `OG-${suffix}-${key}`.toUpperCase(),
    status: "published",
    shortInfo: "",
    description: "",
    price: "5.00",
    currency: "EUR",
    inStock: true,
    stockQuantity: "1",
    images: [],
    categories: [],
    meta: { title: "", description: "", keywords: "", ogImageAssetId },
    reviews: [],
  });
}

async function create(ogImageAssetId: string, key: string): Promise<string> {
  const result = await createProduct(input(ogImageAssetId, key), null);
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.errors)}`);
  productIds.push(result.id);
  return result.id;
}

afterAll(async () => {
  for (const id of productIds) await deleteProduct(id, null);
  for (const id of assetIds) await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  await pool.end();
});

describe("the OG image field", () => {
  it("stores the picked asset id on the product", async () => {
    // AC2.
    const asset = await makeAsset("picked");
    const productId = await create(asset, "picked");

    expect((await getProductForEdit(productId))?.meta.ogImageAssetId).toBe(asset);
  });

  it("resolves a URL so the form can show what was picked", async () => {
    const edit = await getProductForEdit(productIds[0]!);

    expect(edit?.ogImageUrl).toBe(`/api/v1/media/file/${assetIds[0]}`);
  });

  it("leaves the key out entirely when no image is chosen", async () => {
    // Absent rather than empty: the usage query matches on the key existing,
    // and an empty string would make every product look like a user of "".
    const productId = await create("", "none");
    const edit = await getProductForEdit(productId);

    expect(edit?.meta.ogImageAssetId).toBeUndefined();
    expect(edit?.ogImageUrl).toBe("");
  });

  it("counts toward the asset's usage", async () => {
    const usage = await usageForAsset(assetIds[0]!);

    expect(usage).toHaveLength(1);
    expect(usage[0]!.kind).toBe("ogImage");
  });

  it("stops the asset being deleted while a product points at it", async () => {
    // The whole reason usage counts OG references and not just galleries.
    const result = await deleteAsset(assetIds[0]!, null);

    expect(result.ok).toBe(false);
  });

  it("refuses an id that is not a real reference", async () => {
    const parsed = productInputSchema.safeParse({
      ...input("", "bad"),
      meta: { title: "", description: "", keywords: "", ogImageAssetId: "nope" },
    });

    expect(parsed.success).toBe(false);
  });

  it("can be replaced and cleared", async () => {
    const first = await makeAsset("first");
    const second = await makeAsset("second");
    const productId = await create(first, "swap");

    const swap = { ...input(second, "swap"), meta: { title: "", description: "", keywords: "", ogImageAssetId: second } };
    expect((await updateProduct(productId, swap, null)).ok).toBe(true);
    expect((await getProductForEdit(productId))?.meta.ogImageAssetId).toBe(second);

    const cleared = { ...swap, meta: { ...swap.meta, ogImageAssetId: "" } };
    expect((await updateProduct(productId, cleared, null)).ok).toBe(true);
    expect((await getProductForEdit(productId))?.meta.ogImageAssetId).toBeUndefined();

    // And the asset is free again.
    expect(await usageForAsset(second)).toEqual([]);
  });
});
