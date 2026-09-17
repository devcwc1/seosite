import { z } from "zod";

import type { ProductMeta } from "@/lib/db/schema";

/**
 * Per-page SEO fields, shared by products and categories.
 *
 * One schema and one mapper for both, because the two forms edit the same
 * shape and the storefront renders it the same way. Two copies are how a
 * field gets validated on one page and silently accepted on the other.
 */

/** Recommended upper bounds — the counters warn here; the schema is looser. */
export const META_TITLE_LIMIT = 60;
export const META_DESCRIPTION_LIMIT = 160;

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
  title: z.string().trim().max(255),
  description: z.string().trim().max(1000),
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
