import { describe, expect, it } from "vitest";

import type { StorefrontProduct, StorefrontSite } from "./index";
import {
  applyTitleTemplate,
  breadcrumbJsonLd,
  buildRobotsTxt,
  htmlToPlainText,
  joinUrl,
  productJsonLd,
  serializeJsonLd,
  siteJsonLd,
} from "./seo";

const product: StorefrontProduct = {
  id: "p1",
  slug: "orbit-mug",
  sku: "MUG-1",
  title: "Orbit Mug",
  shortInfo: "A mug.",
  description: "<h2>Details</h2><p>Holds <strong>coffee</strong> &amp; tea.</p>",
  priceCents: 1899,
  currency: "EUR",
  inStock: true,
  images: [{ url: "https://cdn.example/mug.webp", position: 0 }],
  categories: [],
  seo: {
    title: null,
    description: null,
    keywords: null,
    ogImageUrl: null,
    noindex: false,
    canonicalUrl: null,
  },
  updatedAt: "2026-09-17T00:00:00.000Z",
};

const site: StorefrontSite = {
  siteName: "Orbit",
  titleTemplate: "%s · Orbit",
  siteUrl: "https://shop.example",
  defaultDescription: null,
  defaultOgImageUrl: null,
  logoUrl: "https://cdn.example/logo.webp",
  twitterHandle: null,
  allowIndexing: true,
  robotsExtra: "",
};

describe("titles and urls", () => {
  it("puts the page title into the template", () => {
    expect(applyTitleTemplate("%s · Orbit", "Mug")).toBe("Mug · Orbit");
  });

  it("joins without doubling or dropping the slash", () => {
    expect(joinUrl("https://a.test/", "/b")).toBe("https://a.test/b");
    expect(joinUrl("https://a.test", "b")).toBe("https://a.test/b");
  });
});

describe("htmlToPlainText", () => {
  it("strips markup and decodes entities", () => {
    expect(htmlToPlainText(product.description!)).toBe("Details Holds coffee & tea.");
  });

  it("cuts on a word boundary and marks the cut", () => {
    const text = htmlToPlainText("<p>one two three four five six</p>", 16);
    expect(text).toBe("one two three…");
    expect(text.length).toBeLessThanOrEqual(16);
  });
});

describe("serializeJsonLd", () => {
  it("cannot be used to close the script tag", () => {
    // Product names are editor input; this must not break out of <script>.
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });

    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
  });

  it("is still the same JSON to a parser", () => {
    const data = { name: "A & B <c>  " };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});

describe("buildRobotsTxt", () => {
  it("allows crawling, keeps private paths out, and points at the sitemap", () => {
    expect(
      buildRobotsTxt({
        allowIndexing: true,
        sitemapUrl: "https://shop.example/sitemap.xml",
        disallow: ["/cart", "/checkout"],
      }),
    ).toBe(
      "User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\n\nSitemap: https://shop.example/sitemap.xml\n",
    );
  });

  it("disallows everything and advertises no sitemap when indexing is off", () => {
    const txt = buildRobotsTxt({
      allowIndexing: false,
      sitemapUrl: "https://shop.example/sitemap.xml",
      disallow: ["/cart"],
    });

    expect(txt).toBe("User-agent: *\nDisallow: /\n");
  });

  it("appends the admin's extra lines verbatim", () => {
    const txt = buildRobotsTxt({
      allowIndexing: true,
      sitemapUrl: null,
      extra: "User-agent: GPTBot\nDisallow: /",
    });

    expect(txt).toContain("\n\nUser-agent: GPTBot\nDisallow: /\n");
  });
});

describe("structured data", () => {
  it("describes a product and its offer", () => {
    const ld = productJsonLd(product, {
      url: "https://shop.example/products/orbit-mug",
      siteName: "Orbit",
    });

    expect(ld).toMatchObject({
      "@type": "Product",
      name: "Orbit Mug",
      sku: "MUG-1",
      description: "A mug.",
      image: ["https://cdn.example/mug.webp"],
      offers: {
        "@type": "Offer",
        price: "18.99",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    });
  });

  it("prefers the editor's meta description", () => {
    const ld = productJsonLd(
      { ...product, seo: { ...product.seo, description: "Edited." } },
      { url: "u", siteName: "Orbit" },
    );
    expect(ld.description).toBe("Edited.");
  });

  it("marks an unavailable product out of stock", () => {
    const ld = productJsonLd({ ...product, inStock: false }, { url: "u", siteName: "O" });
    expect((ld.offers as Record<string, unknown>).availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("numbers breadcrumbs from one", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", url: "https://shop.example/" },
      { name: "Mugs", url: "https://shop.example/categories/mugs" },
    ]);

    expect((ld.itemListElement as { position: number }[]).map((i) => i.position)).toEqual([1, 2]);
  });

  it("describes the organisation and offers a site search", () => {
    const [org, website] = siteJsonLd(site, "https://shop.example");

    expect(org).toMatchObject({ "@type": "Organization", logo: site.logoUrl });
    expect(JSON.stringify(website)).toContain(
      "https://shop.example/products?q={search_term_string}",
    );
  });
});
