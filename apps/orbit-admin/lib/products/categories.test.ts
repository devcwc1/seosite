import { afterAll, describe, expect, it } from "vitest";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/categories/mutations";
import { categoryInputSchema } from "@/lib/categories/validation";
import { categoriesCollection } from "@/lib/db/mongo-collections";
import { getStorefrontProduct } from "@/lib/storefront/products";

import {
  createProduct,
  deleteProduct,
  getProductForEdit,
  updateProduct,
} from "./mutations";
import { productInputSchema, type ProductParsed } from "./validation";

const suffix = Date.now().toString(36);
const productSlug = `cat-product-${suffix}`;
const productIds: string[] = [];
const categoryIds: string[] = [];

function categoryInput(name: string, slug: string, description = "") {
  return categoryInputSchema.parse({
    name,
    slug,
    description,
    position: "0",
    meta: { title: "", description: "", keywords: "" },
  });
}

async function makeCategory(name: string, slug: string) {
  const result = await createCategory(categoryInput(name, slug), null);
  if (!result.ok) throw new Error(`category fixture failed: ${slug}`);
  categoryIds.push(result.id);
  return result.id;
}

function productInput(
  selections: { categoryId: string; isPrimary: boolean }[],
  status: "draft" | "published" = "draft",
): ProductParsed {
  return productInputSchema.parse({
    title: `Category product ${suffix}`,
    slug: productSlug,
    sku: `CATP-${suffix}`,
    status,
    shortInfo: "Fixture",
    description: "Fixture",
    price: "9.99",
    currency: "EUR",
    inStock: true,
    stockQuantity: "3",
    images: [],
    categories: selections,
    meta: { title: "", description: "", keywords: "" },
    reviews: [],
  });
}

afterAll(async () => {
  for (const id of productIds) await deleteProduct(id, null);
  if (categoryIds.length) {
    await categoriesCollection().deleteMany({ _id: { $in: categoryIds } });
  }
  // The shared Mongo client is closed by test/setup.ts.
});

describe("categories as archive pages", () => {
  it("creates one with its own copy and SEO meta", async () => {
    const id = await makeCategory(`Sleep aids ${suffix}`, `sleep-aids-${suffix}`);

    const result = await updateCategory(
      id,
      categoryInputSchema.parse({
        name: `Sleep aids ${suffix}`,
        slug: `sleep-aids-${suffix}`,
        description: "Everything for a better night.",
        position: "2",
        meta: {
          title: "Sleep aids | Shop",
          description: "Browse our sleep range.",
          keywords: "sleep, insomnia",
        },
      }),
      null,
    );
    expect(result.ok).toBe(true);

    const row = await categoriesCollection().findOne({ _id: id });

    expect(row?.description).toBe("Everything for a better night.");
    expect(row?.meta).toEqual({
      title: "Sleep aids | Shop",
      description: "Browse our sleep range.",
      keywords: "sleep, insomnia",
    });
    expect(row?.position).toBe(2);
  });

  it("refuses a duplicate slug, because the slug is a URL", async () => {
    const slug = `pain-relief-${suffix}`;
    await makeCategory(`Pain relief ${suffix}`, slug);

    const clash = await createCategory(
      categoryInput("Something else", slug),
      null,
    );

    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.errors.slug).toContain("already in use");
  });

  it("files a product under categories and reads them back for the form", async () => {
    const [sleep, pain] = [categoryIds[0]!, categoryIds[1]!];

    const created = await createProduct(
      productInput([
        { categoryId: sleep, isPrimary: false },
        { categoryId: pain, isPrimary: true },
      ]),
      null,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    productIds.push(created.id);

    const edit = await getProductForEdit(created.id);
    expect(edit?.categories).toEqual([
      { categoryId: sleep, isPrimary: false },
      { categoryId: pain, isPrimary: true },
    ]);
  });

  it("carries name and slug onto the storefront DTO once published", async () => {
    const id = productIds[0]!;
    const pain = categoryIds[1]!;

    await updateProduct(
      id,
      productInput([{ categoryId: pain, isPrimary: true }], "published"),
      null,
    );

    const dto = await getStorefrontProduct(productSlug);
    expect(dto?.categories).toEqual([
      {
        slug: `pain-relief-${suffix}`,
        name: `Pain relief ${suffix}`,
        isPrimary: true,
      },
    ]);
  });

  it("always leaves exactly one primary", async () => {
    const id = productIds[0]!;

    // Nothing marked primary — the first selection takes it.
    await updateProduct(
      id,
      productInput([
        { categoryId: categoryIds[0]!, isPrimary: false },
        { categoryId: categoryIds[1]!, isPrimary: false },
      ]),
      null,
    );

    const edit = await getProductForEdit(id);
    const primaries = edit?.categories.filter((c) => c.isPrimary) ?? [];
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.categoryId).toBe(categoryIds[0]);
  });

  it("counts the products filed under each category", async () => {
    const all = await listCategories();
    const sleep = all.find((c) => c.id === categoryIds[0]);

    expect(sleep?.productCount).toBe(1);
  });

  it("refuses to delete a category that still holds products", async () => {
    const result = await deleteCategory(categoryIds[0]!, null);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("still filed here");
  });

  it("deletes one that is empty", async () => {
    const id = await makeCategory(`Empty ${suffix}`, `empty-${suffix}`);

    await expect(deleteCategory(id, null)).resolves.toMatchObject({ ok: true });

    const row = await categoriesCollection().findOne({ _id: id });
    expect(row).toBeNull();
  });
});
