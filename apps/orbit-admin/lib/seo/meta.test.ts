import { describe, expect, it } from "vitest";

import {
  META_DESCRIPTION_LIMIT,
  META_DESCRIPTION_MAX,
  META_TITLE_LIMIT,
  META_TITLE_MAX,
  seoMetaInputSchema,
  seoPublishWarnings,
} from "./meta";

/**
 * ORB-601: the counters warn past the recommended length but never block; the
 * schema blocks only past the hard cap. These are the boundary cases.
 */

const base = {
  title: "",
  description: "",
  keywords: "",
  ogImageAssetId: "",
  noindex: false,
  canonicalUrl: "",
};

function titleError(input: Record<string, unknown>) {
  const result = seoMetaInputSchema.safeParse({ ...base, ...input });
  if (result.success) return null;
  return result.error.issues.find((issue) => issue.path[0] === "title") ?? null;
}

function descriptionError(input: Record<string, unknown>) {
  const result = seoMetaInputSchema.safeParse({ ...base, ...input });
  if (result.success) return null;
  return result.error.issues.find((issue) => issue.path[0] === "description") ?? null;
}

describe("seo meta hard caps", () => {
  it("does not block an overlength title (past the recommendation, under the cap)", () => {
    // 70 > 60 recommended, but the draft must still save.
    expect(titleError({ title: "a".repeat(META_TITLE_LIMIT + 10) })).toBeNull();
  });

  it("accepts a title exactly at the hard cap", () => {
    expect(titleError({ title: "a".repeat(META_TITLE_MAX) })).toBeNull();
  });

  it("blocks a title one character past the hard cap", () => {
    expect(titleError({ title: "a".repeat(META_TITLE_MAX + 1) })).not.toBeNull();
  });

  it("does not block an overlength description under the cap", () => {
    expect(
      descriptionError({ description: "a".repeat(META_DESCRIPTION_LIMIT + 20) }),
    ).toBeNull();
  });

  it("accepts a description exactly at the hard cap", () => {
    expect(descriptionError({ description: "a".repeat(META_DESCRIPTION_MAX) })).toBeNull();
  });

  it("blocks a description one character past the hard cap", () => {
    expect(
      descriptionError({ description: "a".repeat(META_DESCRIPTION_MAX + 1) }),
    ).not.toBeNull();
  });

  it("allows both fields empty (drafting stays frictionless)", () => {
    expect(seoMetaInputSchema.safeParse(base).success).toBe(true);
  });
});

describe("seoPublishWarnings", () => {
  it("lists an empty meta description", () => {
    const warnings = seoPublishWarnings({ title: "Set", description: "" });
    expect(warnings.map((w) => w.field)).toContain("description");
  });

  it("lists an empty meta title", () => {
    const warnings = seoPublishWarnings({ title: "  ", description: "Set" });
    expect(warnings.map((w) => w.field)).toContain("title");
  });

  it("is silent when both are set", () => {
    expect(seoPublishWarnings({ title: "T", description: "D" })).toEqual([]);
  });
});
