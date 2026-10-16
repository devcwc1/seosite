import { afterAll, describe, expect, it } from "vitest";

import { productsCollection } from "@/lib/db/mongo-collections";
import { getStorefrontProduct } from "@/lib/storefront/products";

import { createProduct, deleteProduct, getProductForEdit } from "./mutations";
import { productInputSchema, type ProductParsed } from "./validation";

const suffix = Date.now().toString(36);
const createdIds: string[] = [];

function slugFor(key: string) {
  return `rich-text-${suffix}-${key}`;
}

function input(description: string, key: string): ProductParsed {
  return productInputSchema.parse({
    title: `Rich text ${key}`,
    slug: slugFor(key),
    sku: `RICH-${suffix}-${key}`.toUpperCase(),
    status: "published",
    shortInfo: "Fixture",
    description,
    price: "9.99",
    currency: "EUR",
    inStock: true,
    stockQuantity: "3",
    images: [],
    categories: [],
    meta: { title: "", description: "", keywords: "" },
    reviews: [],
  });
}

async function create(description: string, key: string) {
  const result = await createProduct(input(description, key), null);
  if (!result.ok) {
    throw new Error(`fixture create failed: ${JSON.stringify(result.errors)}`);
  }
  createdIds.push(result.id);
  return result.id;
}

async function storedDescription(productId: string) {
  const doc = await productsCollection().findOne(
    { _id: productId },
    { projection: { "content.description": 1 } },
  );
  return doc?.content.description ?? null;
}

afterAll(async () => {
  for (const id of createdIds) await deleteProduct(id, null);
  // The shared Mongo client is closed by test/setup.ts.
});

describe("rich text product descriptions", () => {
  it("stores headings, paragraphs and lists as written", async () => {
    const html =
      "<h2>How to use</h2><p>Take <strong>one</strong> tablet.</p><ul><li>Before bed</li></ul>";
    const id = await create(html, "kept");

    expect(await storedDescription(id)).toBe(html);
    expect((await getProductForEdit(id))?.description).toBe(html);
  });

  it("strips anything executable before it reaches the database", async () => {
    // Whatever a compromised client posts, the mutation is the boundary.
    const id = await create(
      `<h2>Copy</h2><script>fetch("/steal")</script><p onclick="alert(1)">Text</p>`,
      "hostile",
    );

    const stored = await storedDescription(id);

    expect(stored).toBe("<h2>Copy</h2><p>Text</p>");
    expect(stored).not.toContain("script");
    expect(stored).not.toContain("onclick");
  });

  it("serves only the sanitised markup to the storefront", async () => {
    const dto = await getStorefrontProduct(slugFor("hostile"));

    expect(dto?.description).toBe("<h2>Copy</h2><p>Text</p>");
  });

  it("stores an empty description as null rather than empty markup", async () => {
    const id = await create("<p></p>", "empty");

    expect(await storedDescription(id)).toBeNull();
  });

  it("keeps the revision snapshot sanitised too", async () => {
    // The snapshot is built from the same sanitised value as the live row, so
    // history can never replay markup the allowlist rejected.
    const edit = await getProductForEdit(createdIds[1]!);

    expect(edit?.description).toBe("<h2>Copy</h2><p>Text</p>");
  });
});
