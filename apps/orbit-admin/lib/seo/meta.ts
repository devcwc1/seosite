import { z } from "zod";

import type { ProductMeta } from "@/lib/db/model-types";

/**
 * Per-page SEO fields, shared by products and categories.
 *
 * One schema and one mapper for both, because the two forms edit the same
 * shape and the storefront renders it the same way. Two copies are how a
 * field gets validated on one page and silently accepted on the other.
 */

/**
 * Recommended upper bounds — the counters warn here, but nothing blocks:
 * exceeding the length a search engine displays is a quality choice, not an
 * error (ORB-601).
 */
export const META_TITLE_LIMIT = 60;
export const META_DESCRIPTION_LIMIT = 160;

/**
 * Hard storage caps (ORB-601). Past the recommended length the counter only
 * warns; past these the field is rejected outright. They sit well above the
 * SERP-display length so deliberate overrun stays possible, but not unbounded.
 */
export const META_TITLE_MAX = 120;
export const META_DESCRIPTION_MAX = 320;

/**
 * An absolute http(s) URL, or empty. Anything else — a relative path, a
 * `javascript:` URL — would end up in a `<link rel="canonical">` and tell a
 * search engine the page lives somewhere it does not.
 */
export const absoluteHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      if (value === "") return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Use a full URL starting with https://" },
  );

export const seoMetaInputSchema = z.object({
  title: z
    .string()
    .trim()
    .max(META_TITLE_MAX, `Keep the meta title to ${META_TITLE_MAX} characters or fewer`),
  description: z
    .string()
    .trim()
    .max(
      META_DESCRIPTION_MAX,
      `Keep the meta description to ${META_DESCRIPTION_MAX} characters or fewer`,
    ),
  keywords: z.string().trim().max(500),
  // Empty means "no image"; otherwise it must be a real asset reference.
  ogImageAssetId: z
    .union([z.literal(""), z.string().uuid("Invalid image reference")])
    .default(""),
  /** Ask search engines not to index this page. */
  noindex: z.boolean().default(false),
  /** Set only when this page's content canonically lives at another URL. */
  canonicalUrl: absoluteHttpUrl.default(""),
});

export type SeoMetaInput = z.output<typeof seoMetaInputSchema>;

/**
 * What gets stored. Keys are omitted rather than written empty: the usage
 * query matches on `ogImageAssetId` existing, and `noindex: false` is the
 * default a missing key already means.
 */
export function toStoredMeta(input: SeoMetaInput): ProductMeta {
  const meta: ProductMeta = {};
  if (input.title) meta.title = input.title;
  if (input.description) meta.description = input.description;
  if (input.keywords) meta.keywords = input.keywords;
  if (input.ogImageAssetId) meta.ogImageAssetId = input.ogImageAssetId;
  if (input.noindex) meta.noindex = true;
  if (input.canonicalUrl) meta.canonicalUrl = input.canonicalUrl;
  return meta;
}

/** One thing the editor should know before publishing (ORB-601). */
export type SeoPublishWarning = { field: "title" | "description"; message: string };

/**
 * Metadata-quality notices to surface when a page is about to be published.
 *
 * Empty title/description are fine while drafting — that is the whole point of
 * "empty-at-draft allowed". At publish they are listed so the editor sees what
 * search engines will fall back to. Advisory only: this never blocks a save.
 */
export function seoPublishWarnings(meta: {
  title?: string;
  description?: string;
}): SeoPublishWarning[] {
  const warnings: SeoPublishWarning[] = [];
  if (!meta.title?.trim()) {
    warnings.push({
      field: "title",
      message: "Meta title is empty — the page's own title will be used instead.",
    });
  }
  if (!meta.description?.trim()) {
    warnings.push({
      field: "description",
      message:
        "Meta description is empty — search engines will choose their own snippet.",
    });
  }
  return warnings;
}
