import { buildRobotsTxt } from "@orbit/next/seo";

import { absoluteUrl, getSite } from "@/lib/seo";

/**
 * robots.txt, controlled from Orbit (Settings → Search & social).
 *
 * A route handler rather than Next's `robots.ts`, because the admin can add
 * arbitrary lines — rules for a specific crawler, say — and the typed robots
 * object has nowhere to put them.
 */
export const revalidate = 60;

/** Pages that exist for one shopper and never belong in a search index. */
const PRIVATE_PATHS = ["/cart", "/checkout"];

export async function GET(): Promise<Response> {
  const site = await getSite();

  const body = buildRobotsTxt({
    allowIndexing: site.allowIndexing,
    sitemapUrl: absoluteUrl(site, "/sitemap.xml"),
    disallow: PRIVATE_PATHS,
    extra: site.robotsExtra,
  });

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
