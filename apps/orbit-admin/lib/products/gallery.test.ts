import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import {
  mediaAssetsCollection,
  productsCollection,
} from "@/lib/db/mongo-collections";
import {
  linkAssetToProduct,
  unlinkAssetFromProduct,
} from "@/lib/media/assets";
import { processUpload } from "@/lib/media/process";
import { deleteStored } from "@/lib/media/storage";
import { getStorefrontProduct } from "@/lib/storefront/products";
import {
  createProduct,
  deleteProduct,
  getProductForEdit,
  updateProduct,
} from "./mutations";
import { productInputSchema, type ProductParsed } from "./validation";

const suffix = Date.now().toString(36);
const productIds: string[] = [];
const assetIds: string[] = [];

/** Upload a unique image through the hardened pipeline and return its id. */
async function makeAsset(red: number): Promise<string> {
  const png = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: { r: red, g: 90, b: 200 },
    },
  })
    .png()
    .toBuffer();

  const { asset } = await processUpload(
    new File([new Uint8Array(png)], `gallery-${suffix}-${red}.png`, {
      type: "image/png",
    }),
    null,
  );
  assetIds.push(asset.id);
  return asset.id;
}

function formInput(
  images: { assetId: string; alt: string }[],
  status: "draft" | "published" = "draft",
): ProductParsed {
  return productInputSchema.parse({
    title: `Gallery product ${suffix}`,
    slug: `gallery-product-${suffix}`,
    sku: `GAL-${suffix}`,
    status,
    shortInfo: "Short info",
    description: "Description",
    price: "19.99",
    currency: "EUR",
    inStock: true,
    stockQuantity: "5",
    images,
    categories: [],
    meta: { title: "", description: "", keywords: "" },
    reviews: [],
  });
}

/** The product's embedded gallery refs (was the product_media join). */
async function galleryOf(productId: string) {
  const doc = await productsCollection().findOne(
    { _id: productId },
    { projection: { media: 1 } },
  );
  return doc?.media ?? [];
}

afterAll(async () => {
  for (const id of productIds) await deleteProduct(id, null);
  for (const id of assetIds) {
    const row = await mediaAssetsCollection().findOne({ _id: id });
    if (row?.storageKey) await deleteStored(row.storageKey);
    await mediaAssetsCollection().deleteOne({ _id: id });
  }
});

describe("product gallery round-trip (ORB-501)", () => {
  it("prefills the edit form with the product's gallery, in order", async () => {
    const [first, second] = [await makeAsset(10), await makeAsset(20)];
    const created = await createProduct(
      formInput([
        { assetId: first, alt: "First alt" },
        { assetId: second, alt: "Second alt" },
      ]),
      null,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    productIds.push(created.id);

    const edit = await getProductForEdit(created.id);
    expect(edit?.images).toEqual([
      { assetId: first, url: `/api/v1/media/file/${first}`, alt: "First alt" },
      { assetId: second, url: `/api/v1/media/file/${second}`, alt: "Second alt" },
    ]);
  });

  it("keeps the gallery when the prefilled form is resubmitted", async () => {
    const id = productIds[0];
    expect(id).toBeTruthy();

    // Exactly what the form does on save: send back `initial.images` untouched.
    const edit = await getProductForEdit(id!);
    const resubmitted = edit!.images.map((image) => ({
      assetId: image.assetId,
      alt: image.alt,
    }));

    const updated = await updateProduct(id!, formInput(resubmitted), null);
    expect(updated.ok).toBe(true);

    const links = await galleryOf(id!);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.position).sort()).toEqual([0, 1]);
  });

  it("serves the gallery to the storefront read model once published", async () => {
    const id = productIds[0];
    const edit = await getProductForEdit(id!);
    const images = edit!.images.map((image) => ({
      assetId: image.assetId,
      alt: image.alt,
    }));

    const published = await updateProduct(
      id!,
      formInput(images, "published"),
      null,
    );
    expect(published.ok).toBe(true);

    const dto = await getStorefrontProduct(`gallery-product-${suffix}`);
    expect(dto?.images.map((image) => image.url)).toEqual(
      images.map((image) => `/api/v1/media/file/${image.assetId}`),
    );
  });

  it("appends an in-product upload at the next gallery position", async () => {
    const id = productIds[0];
    const third = await makeAsset(30);

    // What POST /api/v1/media/upload does when given a productId.
    await linkAssetToProduct(id!, third);
    await linkAssetToProduct(id!, third); // idempotent

    const links = await galleryOf(id!);
    expect(links).toHaveLength(3);
    expect(
      links.find((link) => link.mediaAssetId === third)?.position,
    ).toBe(2);
  });

  it("unlinks a single asset without touching the rest (idempotent)", async () => {
    const id = productIds[0];
    const before = await galleryOf(id!);
    const target = before.at(-1)!.mediaAssetId;

    // What removeProductImageAction does on the product detail page.
    await unlinkAssetFromProduct(id!, target);
    await unlinkAssetFromProduct(id!, target); // idempotent

    const after = await galleryOf(id!);
    expect(after).toHaveLength(before.length - 1);
    expect(after.find((link) => link.mediaAssetId === target)).toBeUndefined();
  });
});
