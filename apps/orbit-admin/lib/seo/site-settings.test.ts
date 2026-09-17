import { describe, expect, it } from "vitest";

import { seoMetaInputSchema, toStoredMeta } from "./meta";
import {
  DEFAULT_SITE_SEO_SETTINGS,
  parseStoredSiteSeoSettings,
  siteSeoSettingsSchema,
} from "./site-settings";

function valid(overrides: Record<string, unknown> = {}) {
  return siteSeoSettingsSchema.safeParse({ ...DEFAULT_SITE_SEO_SETTINGS, ...overrides });
}

describe("site SEO settings", () => {
  it("accepts the defaults", () => {
    expect(valid().success).toBe(true);
  });

  it("insists the title template has somewhere to put the page title", () => {
    expect(valid({ titleTemplate: "Apotheek" }).success).toBe(false);
    expect(valid({ titleTemplate: "%s | Apotheek" }).success).toBe(true);
  });

  it("only takes a full http(s) origin as the site URL", () => {
    expect(valid({ siteUrl: "example.com" }).success).toBe(false);
    expect(valid({ siteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(valid({ siteUrl: "ftp://example.com" }).success).toBe(false);
    expect(valid({ siteUrl: "" }).success).toBe(true);
  });

  it("strips a trailing slash so paths can be appended without doubling it", () => {
    const parsed = valid({ siteUrl: "https://shop.example.com/" });
    expect(parsed.success && parsed.data.siteUrl).toBe("https://shop.example.com");
  });

  it("normalises a twitter handle to include the @", () => {
    const parsed = valid({ twitterHandle: "orbitshop" });
    expect(parsed.success && parsed.data.twitterHandle).toBe("@orbitshop");
    expect(valid({ twitterHandle: "not a handle" }).success).toBe(false);
  });

  it("normalises robots lines to one line ending with no trailing blank", () => {
    // A blank line inside robots.txt ends a rule group.
    const parsed = valid({ robotsExtra: "Disallow: /private\r\n\r\n" });
    expect(parsed.success && parsed.data.robotsExtra).toBe("Disallow: /private");
  });
});

describe("reading stored settings", () => {
  it("returns defaults when nothing has been saved", () => {
    expect(parseStoredSiteSeoSettings(undefined)).toEqual(DEFAULT_SITE_SEO_SETTINGS);
  });

  it("keeps the good fields when one stored value is bad", () => {
    // The row is jsonb and can be hand-edited; one bad field must not throw
    // every other setting away with it.
    const parsed = parseStoredSiteSeoSettings({
      siteName: "Apotheek",
      titleTemplate: "no placeholder",
      allowIndexing: false,
    });

    expect(parsed.siteName).toBe("Apotheek");
    expect(parsed.allowIndexing).toBe(false);
    expect(parsed.titleTemplate).toBe(DEFAULT_SITE_SEO_SETTINGS.titleTemplate);
  });
});

describe("page meta", () => {
  const base = { title: "", description: "", keywords: "" };

  it("refuses a canonical URL that is not absolute http(s)", () => {
    for (const canonicalUrl of ["/products/x", "javascript:alert(1)", "example.com"]) {
      expect(seoMetaInputSchema.safeParse({ ...base, canonicalUrl }).success).toBe(false);
    }
  });

  it("stores only the keys that carry a value", () => {
    const parsed = seoMetaInputSchema.parse({ ...base, title: "T" });

    expect(toStoredMeta(parsed)).toEqual({ title: "T" });
  });

  it("stores noindex and canonical when set", () => {
    const parsed = seoMetaInputSchema.parse({
      ...base,
      noindex: true,
      canonicalUrl: "https://example.com/elsewhere",
    });

    expect(toStoredMeta(parsed)).toEqual({
      noindex: true,
      canonicalUrl: "https://example.com/elsewhere",
    });
  });
});
