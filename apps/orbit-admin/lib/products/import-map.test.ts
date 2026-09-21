import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";
import {
  DEFAULT_IMPORT_OPTIONS,
  deduplicateSlugs,
  parseBoolean,
  parseCategories,
  parseDecimal,
  parseImageUrls,
  parseRow,
  type ColumnMapping,
  type ImportRow,
} from "./import-map";

describe("parseCsv", () => {
  it("reads a comma file with quoted, multiline fields", () => {
    const text = 'Name,Price,Description\nMug,"18,99","Line one\nLine two"\n';
    const { delimiter, headers, rows } = parseCsv(text);

    expect(delimiter).toBe(",");
    expect(headers).toEqual(["Name", "Price", "Description"]);
    expect(rows).toEqual([["Mug", "18,99", "Line one\nLine two"]]);
  });

  it("reads a tab file and doubles-quote escapes", () => {
    const text = 'Name\tNote\n"Say ""hi"""\tplain\n';
    const { delimiter, rows } = parseCsv(text);

    expect(delimiter).toBe("\t");
    expect(rows[0]).toEqual(['Say "hi"', "plain"]);
  });

  it("pads a short row so later columns do not shift", () => {
    const { rows } = parseCsv("A,B,C\n1,2\n");
    expect(rows[0]).toEqual(["1", "2", ""]);
  });

  it("strips a byte-order mark from the first header", () => {
    const { headers } = parseCsv("﻿Name,Price\nx,1\n");
    expect(headers[0]).toBe("Name");
  });
});

describe("value coercion", () => {
  it("reads both decimal conventions and a currency symbol", () => {
    expect(parseDecimal("€1.234,50")).toBe(1234.5);
    expect(parseDecimal("1,234.50")).toBe(1234.5);
    expect(parseDecimal("18.99")).toBe(18.99);
    expect(parseDecimal("nonsense")).toBeNull();
  });

  it("reads a loose boolean and refuses the ambiguous", () => {
    expect(parseBoolean("Yes")).toBe(true);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("maybe")).toBeNull();
  });

  it("keeps only the leaf of a category path", () => {
    expect(parseCategories("Clothing > Shirts, Sale")).toEqual(["Shirts", "Sale"]);
  });

  it("keeps only http(s) image URLs", () => {
    expect(
      parseImageUrls("https://a.test/1.jpg, ftp://x/2.jpg\nhttp://b.test/3.png"),
    ).toEqual(["https://a.test/1.jpg", "http://b.test/3.png"]);
  });
});

/** A mapping over: SKU, Name, Price, Stock, Categories. */
const MAP: ColumnMapping = { sku: 0, title: 1, price: 2, stockQuantity: 3, categories: 4 };
const opts = DEFAULT_IMPORT_OPTIONS;

describe("parseRow", () => {
  it("coerces a good row", () => {
    const parsed = parseRow(["M-1", "Orbit Mug", "18.99", "12", "Drinkware > Mugs"], MAP, opts, 2);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.row).toMatchObject({
      sku: "M-1",
      title: "Orbit Mug",
      slug: "orbit-mug",
      price: 18.99,
      stockQuantity: 12,
      inStock: true,
      status: "draft",
      categoryNames: ["Mugs"],
      currency: "EUR",
    });
  });

  it("requires a name and a SKU", () => {
    const parsed = parseRow(["", "", "5", "1", ""], MAP, opts, 2);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.map((i) => i.field)).toEqual(expect.arrayContaining(["title", "sku"]));
  });

  it("reports a price that is not a number instead of storing zero", () => {
    const parsed = parseRow(["M-1", "Mug", "call us", "1", ""], MAP, opts, 2);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]).toMatchObject({ field: "price" });
  });

  it("infers out-of-stock from a zero quantity when no stock column is mapped", () => {
    const parsed = parseRow(["M-1", "Mug", "5", "0", ""], MAP, opts, 2);
    expect(parsed.ok && parsed.row.inStock).toBe(false);
  });

  it("only imports images when the option is on", () => {
    const withImg: ColumnMapping = { ...MAP, images: 5 };
    const off = parseRow(["M-1", "Mug", "5", "1", "", "https://a.test/x.jpg"], withImg, opts, 2);
    const on = parseRow(
      ["M-1", "Mug", "5", "1", "", "https://a.test/x.jpg"],
      withImg,
      { ...opts, importImages: true },
      2,
    );
    expect(off.ok && off.row.imageUrls).toEqual([]);
    expect(on.ok && on.row.imageUrls).toEqual(["https://a.test/x.jpg"]);
  });
});

describe("deduplicateSlugs", () => {
  it("keeps the first, suffixes the rest, and avoids existing slugs", () => {
    const rows = [
      { slug: "mug" },
      { slug: "mug" },
      { slug: "mug" },
    ] as ImportRow[];
    deduplicateSlugs(rows, new Set(["mug-2"]));
    expect(rows.map((r) => r.slug)).toEqual(["mug", "mug-3", "mug-4"]);
  });
});
