import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { productsCollection } from "@/lib/db/mongo-collections";
import { mediaAssets } from "@/lib/db/schema";
import { createProduct, deleteProduct } from "@/lib/products/mutations";
import { productInputSchema } from "@/lib/products/validation";

import { deleteAsset, listAssets } from "./assets";

const suffix = Date.now().toString(36);
const assetIds: string[] = [];
const productIds: string[] = [];

async function makeAsset(name: string): Promise<string> {
  const [row] = await db
    .insert(mediaAssets)
    .values({
      sha256: `sd${suffix}${name}`.padEnd(64, "0").slice(0, 64),
      storageKey: `test/${suffix}/${name}.webp`,
      format: "webp",
      mimeType: "image/webp",
      width: 100,
      height: 100,
      sizeBytes: 99,
      originalName: `softdel-${suffix}-${name}.webp`,
    })
    .returning({ id: mediaAssets.id });
  assetIds.push(row!.id);
  return row!.id;
}

async function rowFor(id: string) {
  const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
  return row;
}

afterAll(async () => {
  for (const id of productIds) await deleteProduct(id, null);
  for (const id of assetIds) await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  await pool.end();
});

describe("deleting a media asset", () => {
  it("marks it deleted rather than removing the row", async () => {
    const id = await makeAsset("soft");

    const result = await deleteAsset(id, null);

    expect(result.ok).toBe(true);
    const row = await rowFor(id);
    expect(row, "the row must survive").toBeTruthy();
    expect(row!.deletedAt).toBeInstanceOf(Date);
  });

  it("keeps the stored file, so deletion is reversible", async () => {
    // Reclaiming bytes is a separate, deliberate sweep — not a side effect of
    // one person clicking delete on a shared asset.
    const id = await makeAsset("keepsfile");
    await deleteAsset(id, null);

    expect((await rowFor(id))!.storageKey).toBeTruthy();
  });

  it("drops it out of the library listing", async () => {
    const id = await makeAsset("hidden");
    expect(
      (await listAssets({ query: `softdel-${suffix}-hidden` })).items,
    ).toHaveLength(1);

    await deleteAsset(id, null);

    const after = await listAssets({ query: `softdel-${suffix}-hidden` });
    expect(after.items).toHaveLength(0);
    expect(after.total).toBe(0);
  });

  it("refuses while a product's gallery still uses it", async () => {
    const id = await makeAsset("inuse");
    const product = await createProduct(
      productInputSchema.parse({
        title: `Soft delete ${suffix}`,
        slug: `soft-delete-${suffix}`,
        sku: `SOFTDEL-${suffix}`.toUpperCase(),
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
    if (!product.ok) throw new Error("fixture failed");
    productIds.push(product.id);

    await productsCollection().updateOne(
      { _id: product.id },
      { $push: { media: { mediaAssetId: id, position: 0, alt: null } } },
    );

    const result = await deleteAsset(id, null);

    expect(result.ok).toBe(false);
    expect((await rowFor(id))!.deletedAt).toBeNull();
  });

  it("reports not found for an asset already deleted", async () => {
    // Deleting twice is not an error worth inventing new state for, but it
    // must not silently re-stamp deletedAt and lose when it first happened.
    const id = await makeAsset("twice");
    await deleteAsset(id, null);
    const first = (await rowFor(id))!.deletedAt;

    const second = await deleteAsset(id, null);

    expect(second.ok).toBe(false);
    expect((await rowFor(id))!.deletedAt).toEqual(first);
  });
});
