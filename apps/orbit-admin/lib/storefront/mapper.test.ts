import { describe, expect, it } from "vitest";

import { toStorefrontProduct, type StorefrontProductRow } from "./mapper";

function row(overrides: Partial<StorefrontProductRow> = {}): StorefrontProductRow {
  return {
    id: "6f3c1b1e-0000-4000-8000-000000000001",
    slug: "orbit-mug",
    sku: "ORB-MUG-01",
    priceCents: 1899,
    currency: "EUR",
    stockQuantity: 12,
    title: "Orbit Mug",
    shortInfo: "A 350ml ceramic mug.",
    description: "Dishwasher safe.",
    images: [{ url: "https://cdn.test/a.jpg", alt: "Front", position: 1 }],
    categories: [{ slug: "drinkware", name: "Drinkware", isPrimary: true }],
    ...overrides,
  };
}

describe("toStorefrontProduct", () => {
  it("maps a joined row onto the @orbit/next DTO", () => {
    expect(toStorefrontProduct(row())).toEqual({
      id: "6f3c1b1e-0000-4000-8000-000000000001",
      slug: "orbit-mug",
      sku: "ORB-MUG-01",
      title: "Orbit Mug",
      shortInfo: "A 350ml ceramic mug.",
      description: "Dishwasher safe.",
      priceCents: 1899,
      currency: "EUR",
      inStock: true,
      images: [{ url: "https://cdn.test/a.jpg", alt: "Front", position: 1 }],
      categories: [{ slug: "drinkware", name: "Drinkware", isPrimary: true }],
    });
  });

  it("never leaks the on-hand count, only availability", () => {
    const dto = toStorefrontProduct(row({ stockQuantity: 7 }));

    expect(dto.inStock).toBe(true);
    expect(dto).not.toHaveProperty("stockQuantity");
  });

  it("reports zero and negative stock as out of stock", () => {
    expect(toStorefrontProduct(row({ stockQuantity: 0 })).inStock).toBe(false);
    expect(toStorefrontProduct(row({ stockQuantity: -1 })).inStock).toBe(false);
  });

  it("orders images by position regardless of stored order", () => {
    const dto = toStorefrontProduct(
      row({
        images: [
          { url: "https://cdn.test/c.jpg", position: 3 },
          { url: "https://cdn.test/a.jpg", position: 1 },
          { url: "https://cdn.test/b.jpg", position: 2 },
        ],
      }),
    );

    expect(dto.images.map((image) => image.url)).toEqual([
      "https://cdn.test/a.jpg",
      "https://cdn.test/b.jpg",
      "https://cdn.test/c.jpg",
    ]);
  });

  it("does not mutate the source row while sorting", () => {
    const source = row({
      images: [
        { url: "https://cdn.test/b.jpg", position: 2 },
        { url: "https://cdn.test/a.jpg", position: 1 },
      ],
    });

    toStorefrontProduct(source);

    expect(source.images.map((image) => image.position)).toEqual([2, 1]);
  });

  it("preserves nullable content fields as null", () => {
    const dto = toStorefrontProduct(row({ shortInfo: null, description: null }));

    expect(dto.shortInfo).toBeNull();
    expect(dto.description).toBeNull();
  });

  it("handles products with no images or categories", () => {
    const dto = toStorefrontProduct(row({ images: [], categories: [] }));

    expect(dto.images).toEqual([]);
    expect(dto.categories).toEqual([]);
  });
});
