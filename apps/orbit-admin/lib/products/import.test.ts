import { afterAll, describe, expect, it } from "vitest";

import {
  categoriesCollection,
  productsCollection,
} from "@/lib/db/mongo-collections";
import { getStorefrontProduct } from "@/lib/storefront/products";

import { DEFAULT_IMPORT_OPTIONS, type ColumnMapping, type ImportOptions } from "./import-map";
import { previewImport, runImport } from "./import";

/**
 * Integration, against a real Postgres. The importer joins CSV parsing to the
 * product and category mutations, which a mock cannot exercise. The fixture is
 * a small, ordinary catalogue (mugs and notebooks) — the point under test is
 * the machinery, not any particular data.
 */

const suffix = Date.now().toString(36).toUpperCase();
const sku = (n: string) => `IMP-${suffix}-${n}`;
const catName = `Imported ${suffix}`;

// Header row deliberately in a different order than Orbit's fields, to prove
// the mapping — not column position — is what lands each value.
const HEADER = "Name\tSKU\tRegular price\tStock\tCategories\tShort description\tDescription";
function row(cells: string[]) {
  return cells.join("\t");
}

const OPTIONS: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, defaultStatus: "published" };

// Columns of HEADER, mapped by position.
const MAP: ColumnMapping = {
  title: 0,
  sku: 1,
  price: 2,
  stockQuantity: 3,
  categories: 4,
  shortInfo: 5,
  description: 6,
};

afterAll(async () => {
  const skus = ["A", "B", "C"].map(sku);
  const rows = await productsCollection()
    .find({ sku: { $in: skus } }, { projection: { _id: 1 } })
    .toArray();
  if (rows.length > 0) {
    const { deleteProduct } = await import("./mutations");
    for (const r of rows) await deleteProduct(r._id, null);
  }
  await categoriesCollection().deleteMany({ name: { $in: [catName] } });
  // The shared Mongo client is closed by test/setup.ts.
});

describe("previewImport", () => {
  it("classifies rows and spots new categories without writing anything", async () => {
    const text = [
      HEADER,
      row([`Import Mug ${suffix}`, sku("A"), "18.99", "12", catName, "A mug.", "Ceramic."]),
      row([`Import Pad ${suffix}`, sku("B"), "not-a-price", "3", catName, "", ""]),
    ].join("\n");

    const preview = await previewImport(text, MAP, OPTIONS);

    expect(preview.totalRows).toBe(2);
    expect(preview.toCreate).toBe(1);
    expect(preview.invalid).toBe(1);
    expect(preview.newCategories).toContain(catName);

    // A preview must not create anything.
    const cat = await categoriesCollection().findOne({ name: catName });
    expect(cat).toBeNull();
  });
});

describe("runImport", () => {
  it("creates products, links a new category, and reports per row", async () => {
    const text = [
      HEADER,
      row([`Import Mug ${suffix}`, sku("A"), "€18,99", "12", catName, "A mug.", "<p>Ceramic.</p>"]),
      row([`Import Pad ${suffix}`, sku("B"), "9.50", "0", catName, "", ""]),
      row(["", sku("C"), "5.00", "1", "", "", ""]), // no name → fails
    ].join("\n");

    const result = await runImport(text, MAP, OPTIONS, null);

    expect(result.created).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.categoriesCreated).toBe(1);

    // The comma-decimal price landed correctly.
    const mug = await getStorefrontProduct(
      `import-mug-${suffix}`.toLowerCase(),
    );
    expect(mug?.priceCents).toBe(1899);
    // Stock zero makes it unavailable, matching the storefront rule.
    const pad = await getStorefrontProduct(`import-pad-${suffix}`.toLowerCase());
    expect(pad?.inStock).toBe(false);
    // Category was created once and linked to both.
    expect(mug?.categories.map((c) => c.name)).toContain(catName);
  });

  it("updates an existing product by SKU rather than duplicating it", async () => {
    const text = [
      HEADER,
      row([`Import Mug ${suffix} v2`, sku("A"), "21.00", "5", catName, "Updated.", ""]),
    ].join("\n");

    const result = await runImport(text, MAP, OPTIONS, null);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    // Same slug (the URL did not move), new price and title.
    const mug = await getStorefrontProduct(`import-mug-${suffix}`.toLowerCase());
    expect(mug?.priceCents).toBe(2100);
    expect(mug?.title).toBe(`Import Mug ${suffix} v2`);

    // Exactly one product carries this SKU.
    const rows = await productsCollection().find({ sku: sku("A") }).toArray();
    expect(rows).toHaveLength(1);
  });

  it("skips an existing SKU when updates are turned off", async () => {
    const text = [
      HEADER,
      row([`Should not apply`, sku("A"), "999", "1", "", "", ""]),
    ].join("\n");

    const result = await runImport(text, MAP, { ...OPTIONS, updateExisting: false }, null);

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    const mug = await getStorefrontProduct(`import-mug-${suffix}`.toLowerCase());
    expect(mug?.priceCents).toBe(2100); // unchanged from the previous test
  });
});
