import type { MetadataRoute } from "next";

import { orbit } from "@/lib/orbit";
import { absoluteUrl, getSite } from "@/lib/seo";

/**
 * sitemap.xml, built from what Orbit publishes.
 *
 * Only pages meant to be found are listed: a page an editor marked "hide from
 * search engines" is left out, as is everything when indexing is switched off
 * site-wide. Listing a URL while telling crawlers not to index it is a
 * contradiction search engines report as an error.
 */
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  if (!site.allowIndexing) return [];

  const [products, categories, posts, pages] = await Promise.all([
    orbit.listProducts().catch(() => []),
    orbit.listCategories().catch(() => []),
    orbit.listPosts().catch(() => []),
    orbit.listPages().catch(() => []),
  ]);

  // A page whose canonical points elsewhere is, by its own account, not the
  // page to index — the other URL is.
  const indexable = <T extends { seo: { noindex: boolean; canonicalUrl: string | null } }>(
    item: T,
  ) => !item.seo.noindex && !item.seo.canonicalUrl;

  const newest = [...products, ...categories, ...posts]
    .map((item) => item.updatedAt)
    .sort()
    .at(-1);

  return [
    {
      url: absoluteUrl(site, "/"),
      ...(newest ? { lastModified: newest } : {}),
      changeFrequency: "daily",
      priority: 1,
    },
    { url: absoluteUrl(site, "/products"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl(site, "/categories"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl(site, "/blog"), changeFrequency: "weekly", priority: 0.6 },
    ...categories.filter(indexable).map((category) => ({
      url: absoluteUrl(site, `/categories/${category.slug}`),
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.filter(indexable).map((product) => ({
      url: absoluteUrl(site, `/products/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...posts.filter(indexable).map((post) => ({
      url: absoluteUrl(site, `/blog/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...pages.filter(indexable).map((page) => ({
      url: absoluteUrl(site, `/${page.slug}`),
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
