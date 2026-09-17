import { z } from "zod";

import { absoluteHttpUrl } from "./meta";

/**
 * Site-wide search and social settings — what the storefront uses wherever a
 * page has nothing more specific of its own.
 *
 * Pure (no database) so validation and defaults can be tested directly; the
 * store in ./site-settings-store.ts reads and writes the row.
 */

export const SITE_SEO_SETTING_KEY = "seo.site";

/** Recommended length for the fallback description, matching page meta. */
export const DEFAULT_DESCRIPTION_LIMIT = 160;

export const siteSeoSettingsSchema = z.object({
  /** Shown in page titles, in share cards, and as the organisation's name. */
  siteName: z.string().trim().min(1, "Site name is required").max(120),
  /**
   * How a page title is built. `%s` is replaced with the page's own title;
   * pages with an editor-written meta title use that title as-is instead.
   */
  titleTemplate: z
    .string()
    .trim()
    .max(160)
    .refine((value) => value.includes("%s"), {
      message: "Include %s where the page title should go",
    }),
  /**
   * The storefront's public origin — the base for canonical URLs, the sitemap
   * and share links. Empty falls back to the storefront's own configuration.
   */
  siteUrl: absoluteHttpUrl.transform((value) => value.replace(/\/+$/, "")),
  /** Used on any page that has no description of its own. */
  defaultDescription: z.string().trim().max(1000),
  /** Share image for pages that have none of their own. */
  defaultOgImageAssetId: z.union([z.literal(""), z.string().uuid()]),
  /** The organisation's logo, for structured data. */
  logoAssetId: z.union([z.literal(""), z.string().uuid()]),
  twitterHandle: z
    .string()
    .trim()
    .max(16)
    .refine((value) => value === "" || /^@?[A-Za-z0-9_]{1,15}$/.test(value), {
      message: "A handle is up to 15 letters, numbers or underscores",
    })
    // Stored with the @, which is what the twitter:site tag expects.
    .transform((value) => (value === "" || value.startsWith("@") ? value : `@${value}`)),
  /**
   * Master switch. Off tells every search engine to stay away — robots.txt
   * disallows everything and every page carries noindex — which is what a
   * staging site or a store that is not ready yet needs.
   */
  allowIndexing: z.boolean(),
  /** Extra lines appended to robots.txt, verbatim. */
  robotsExtra: z
    .string()
    .max(4000)
    // One line ending, no trailing blank lines: this is written into a file
    // where a stray blank line ends a rule group.
    .transform((value) => value.replace(/\r\n?/g, "\n").trim()),
});

export type SiteSeoSettings = z.output<typeof siteSeoSettingsSchema>;

/**
 * What a fresh install gets. Indexing is on because that is how the
 * storefront has always behaved; the settings page warns when there is no
 * site URL, since canonical links and the sitemap need one.
 */
export const DEFAULT_SITE_SEO_SETTINGS: SiteSeoSettings = {
  siteName: "Orbit Storefront",
  titleTemplate: "%s · Orbit Storefront",
  siteUrl: "",
  defaultDescription: "",
  defaultOgImageAssetId: "",
  logoAssetId: "",
  twitterHandle: "",
  allowIndexing: true,
  robotsExtra: "",
};

/**
 * Read a stored value defensively. The row is jsonb and can be hand-edited,
 * so each field is validated on its own: one bad value falls back to its
 * default instead of discarding every other setting with it.
 */
export function parseStoredSiteSeoSettings(stored: unknown): SiteSeoSettings {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_SITE_SEO_SETTINGS };

  const record = stored as Record<string, unknown>;
  const result = { ...DEFAULT_SITE_SEO_SETTINGS };
  const shape = siteSeoSettingsSchema.shape;

  for (const key of Object.keys(shape) as (keyof SiteSeoSettings)[]) {
    if (!(key in record)) continue;
    const parsed = shape[key].safeParse(record[key]);
    if (parsed.success) {
      (result as Record<string, unknown>)[key] = parsed.data;
    }
  }

  return result;
}
