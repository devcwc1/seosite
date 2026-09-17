import type { Metadata } from "next";
import { cache } from "react";
import type { StorefrontSeo, StorefrontSite } from "@orbit/next";
import { htmlToPlainText, joinUrl } from "@orbit/next/seo";

import { orbit } from "@/lib/orbit";

/**
 * Everything search-related is controlled from the Orbit admin (Settings →
 * Search & social, plus each product's and category's own fields). This
 * module turns those settings into Next.js metadata, the same way on every
 * page.
 *
 * It has to be one place because Next merges metadata shallowly: a page that
 * sets `openGraph` or `robots` replaces the layout's value wholesale rather
 * than extending it. A page building its own would silently drop the site
 * name from its share card, or — worse — forget the global noindex.
 */

/** What the storefront uses when Orbit cannot be reached. */
const FALLBACK_SITE: StorefrontSite = {
  siteName: "Orbit Storefront",
  titleTemplate: "%s · Orbit Storefront",
  siteUrl: null,
  defaultDescription: null,
  defaultOgImageUrl: null,
  logoUrl: null,
  twitterHandle: null,
  allowIndexing: true,
  robotsExtra: "",
};

/**
 * Site settings, fetched once per request however many layouts, pages and
 * metadata functions ask. A content API outage degrades to the fallback
 * rather than taking every page down with it.
 */
export const getSite = cache(async (): Promise<StorefrontSite> => {
  try {
    return await orbit.getSite();
  } catch {
    return FALLBACK_SITE;
  }
});

/**
 * The public origin. The admin's setting wins; SITE_URL covers a deployment
 * where nobody has set it yet; localhost is only ever right in development.
 */
export function siteOrigin(site: StorefrontSite): string {
  return (site.siteUrl ?? process.env.SITE_URL ?? "http://localhost:3001").replace(
    /\/+$/,
    "",
  );
}

export function absoluteUrl(site: StorefrontSite, path: string): string {
  return joinUrl(siteOrigin(site), path);
}

export type PageSeoOptions = {
  /** The page's canonical path on this site, e.g. `/products/orbit-mug`. */
  path: string;
  /** The page's own title; the site template is applied to it. */
  title?: string;
  /** The editor's values for this page, when it has any. */
  seo?: StorefrontSeo | null;
  /** What to describe the page with when the editor left it blank. */
  description?: string | null;
  /** Images to share with when the editor chose none, in preference order. */
  images?: string[];
  /**
   * Keep this page out of search regardless of settings — cart, checkout,
   * search results. These are not documents anyone should land on from a
   * search engine.
   */
  noindex?: boolean;
};

export function pageMetadata(site: StorefrontSite, options: PageSeoOptions): Metadata {
  const seo = options.seo ?? null;

  // An editor-written meta title is the whole title, as written. Otherwise
  // the page's own title goes through the layout's template.
  const title: Metadata["title"] = seo?.title
    ? { absolute: seo.title }
    : options.title;
  const shareTitle = seo?.title ?? options.title ?? site.siteName;

  const rawDescription =
    seo?.description ?? options.description ?? site.defaultDescription ?? undefined;
  // Descriptions can arrive as rich text (a category intro, a product body).
  const description = rawDescription ? htmlToPlainText(rawDescription, 300) : undefined;

  const canonical = seo?.canonicalUrl ?? absoluteUrl(site, options.path);

  const image =
    seo?.ogImageUrl ?? options.images?.find(Boolean) ?? site.defaultOgImageUrl ?? undefined;

  const indexable = site.allowIndexing && !seo?.noindex && !options.noindex;

  return {
    // Keys are left out rather than set to undefined: Next treats a present
    // key as an override, so `title: undefined` removes the layout's default
    // title entirely instead of falling back to it.
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : // With indexing off site-wide, links are not followed either: the
        // point is that nothing here is meant to be found. A single noindex
        // page still lets crawlers follow its links on to indexable pages.
        { index: false, follow: site.allowIndexing },
    openGraph: {
      type: "website",
      siteName: site.siteName,
      url: canonical,
      title: shareTitle,
      ...(description ? { description } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: shareTitle,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
      ...(site.twitterHandle ? { site: site.twitterHandle } : {}),
    },
  };
}
