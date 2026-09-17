import { describe, expect, it } from "vitest";

import {
  createOrbitClient,
  type StorefrontProduct,
  type OrbitClientOptions,
} from "./index";

const BASE_URL = "http://admin.internal:3000";

function product(images: StorefrontProduct["images"]): StorefrontProduct {
  return {
    id: "9f1c0f4e-3b1d-4a52-9a1a-2f1f6b0c7a11",
    slug: "sleep-aid",
    sku: "SKU-1",
    title: "Sleep aid",
    shortInfo: null,
    description: null,
    priceCents: 1999,
    currency: "EUR",
    inStock: true,
    images,
    categories: [],
    seo: {
      title: null,
      description: null,
      keywords: null,
      ogImageUrl: null,
      noindex: false,
      canonicalUrl: null,
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** A fetch stub that answers both read endpoints with the same product. */
function stubFetch(payload: StorefrontProduct): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const body = url.includes("/api/storefront/products/")
      ? payload
      : [payload];

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function clientFor(
  payload: StorefrontProduct,
  options: Omit<OrbitClientOptions, "fetch" | "baseUrl"> = {},
) {
  return createOrbitClient({
    baseUrl: BASE_URL,
    fetch: stubFetch(payload),
    ...options,
  });
}

const relative = { url: "/api/v1/media/file/abc", position: 0 };

describe("image URL resolution", () => {
  it("prefixes root-relative paths with the API origin by default", async () => {
    const orbit = clientFor(product([relative]));
    const [listed] = await orbit.listProducts();

    expect(listed?.images[0]?.url).toBe(
      "http://admin.internal:3000/api/v1/media/file/abc",
    );
  });

  it("prefers an explicit asset origin and trims its trailing slash", async () => {
    const orbit = clientFor(product([relative]), {
      assetBaseUrl: "https://admin.example.com/",
    });
    const [listed] = await orbit.listProducts();

    expect(listed?.images[0]?.url).toBe(
      "https://admin.example.com/api/v1/media/file/abc",
    );
  });

  it("leaves paths relative when the asset origin is empty", async () => {
    const orbit = clientFor(product([relative]), { assetBaseUrl: "" });
    const [listed] = await orbit.listProducts();

    expect(listed?.images[0]?.url).toBe("/api/v1/media/file/abc");
  });

  it("does not touch absolute URLs (externally backfilled images)", async () => {
    const external = { url: "https://cdn.example.com/x.jpg", position: 0 };
    const orbit = clientFor(product([external]));
    const [listed] = await orbit.listProducts();

    expect(listed?.images[0]?.url).toBe("https://cdn.example.com/x.jpg");
  });

  it("resolves images on a single product too, preserving alt and position", async () => {
    const orbit = clientFor(
      product([{ ...relative, alt: "Blister pack", position: 2 }]),
    );
    const found = await orbit.getProduct("sleep-aid");

    expect(found?.images[0]).toEqual({
      url: "http://admin.internal:3000/api/v1/media/file/abc",
      alt: "Blister pack",
      position: 2,
    });
  });

  it("maps a 404 to null rather than throwing", async () => {
    const orbit = createOrbitClient({
      baseUrl: BASE_URL,
      fetch: (async () => new Response("", { status: 404 })) as typeof fetch,
    });

    await expect(orbit.getProduct("missing")).resolves.toBeNull();
  });
});

describe("createOrder", () => {
  const input = {
    email: "buyer@example.com",
    shipping: {
      name: "A Buyer",
      street: "Street 1",
      postcode: "1234 AB",
      city: "Amsterdam",
      country: "NL",
    },
    items: [{ slug: "sleep-aid", quantity: 2 }],
  };

  it("posts to the orders endpoint with the write token", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;

    const orbit = createOrbitClient({
      baseUrl: BASE_URL,
      writeToken: "s3cret",
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        seen = { url: String(url), init };
        return new Response(
          JSON.stringify({
            orderNumber: "ORB-2026-ABC123",
            currency: "EUR",
            subtotalCents: 3998,
            shippingCents: 0,
            taxCents: 0,
            totalCents: 3998,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const confirmation = await orbit.createOrder(input);

    expect(confirmation.orderNumber).toBe("ORB-2026-ABC123");
    expect(seen!.url).toBe(`${BASE_URL}/api/v1/orders`);
    expect(seen!.init?.method).toBe("POST");
    expect(
      (seen!.init?.headers as Record<string, string>).authorization,
    ).toBe("Bearer s3cret");
    // The client never sends money: Orbit computes every amount.
    expect(seen!.init?.body).not.toContain("Cents");
  });

  it("surfaces Orbit's own explanation when an order is refused", async () => {
    const orbit = createOrbitClient({
      baseUrl: BASE_URL,
      writeToken: "s3cret",
      fetch: (async () =>
        new Response(
          JSON.stringify({ detail: "These products are out of stock: tee" }),
          { status: 409, headers: { "content-type": "application/json" } },
        )) as typeof fetch,
    });

    await expect(orbit.createOrder(input)).rejects.toMatchObject({
      name: "OrbitOrderError",
      status: 409,
      detail: "These products are out of stock: tee",
    });
  });

  it("refuses to send an order with no token configured", async () => {
    const orbit = createOrbitClient({
      baseUrl: BASE_URL,
      writeToken: "",
      fetch: (async () => {
        throw new Error("should not be called");
      }) as typeof fetch,
    });

    await expect(orbit.createOrder(input)).rejects.toMatchObject({
      status: 503,
    });
  });
});
