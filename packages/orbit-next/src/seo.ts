/**
 * `@orbit/next/seo` — turning Orbit's SEO settings into what search engines
 * and social networks read: titles, robots.txt, and JSON-LD.
 *
 * Pure functions with no Next.js dependency, so any consumer renders the same
 * output and the rules can be tested without a server.
 */
import type { StorefrontPost, StorefrontProduct, StorefrontSite } from "./index";

/** Put a page title into the site's template (`%s` is the page title). */
export function applyTitleTemplate(template: string, title: string): string {
  return template.includes("%s") ? template.split("%s").join(title) : title;
}

/** Join an origin and a path without doubling or dropping the slash. */
export function joinUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Markup to plain text, for descriptions in structured data and meta tags.
 * Product copy is rich text; a `<p>` inside a JSON-LD description is noise
 * at best and shows up verbatim in a search result at worst.
 */
export function htmlToPlainText(html: string, maxLength?: number): string {
  const text = html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/blockquote)\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (maxLength === undefined || text.length <= maxLength) return text;
  // Cut on a word boundary and say so, rather than mid-word.
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Built from char codes: written literally, these characters are line
// terminators and would silently end a regex or string mid-expression.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * JSON for a `<script type="application/ld+json">` body.
 *
 * Plain JSON.stringify is not safe here. A product name containing
 * `</script>` would close the tag and let the rest run as HTML — and product
 * names are editor input. Escaping `<`, `>` and `&` as unicode keeps the JSON
 * identical to a parser while giving the HTML parser nothing to act on.
 * U+2028/2029 are escaped too: valid in JSON, line terminators in JavaScript.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

export type RobotsOptions = {
  allowIndexing: boolean;
  /** Absolute URL of the sitemap, or null to leave the line out. */
  sitemapUrl: string | null;
  /** Paths that never belong in a search index, such as cart and checkout. */
  disallow?: string[];
  /** Admin-supplied lines, appended verbatim. */
  extra?: string;
};

/**
 * robots.txt.
 *
 * With indexing off it disallows everything and advertises no sitemap:
 * pointing crawlers at a list of URLs while forbidding them is a mixed
 * signal, and the point of switching indexing off is that there is none.
 */
export function buildRobotsTxt(options: RobotsOptions): string {
  const lines = ["User-agent: *"];

  if (!options.allowIndexing) {
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");
    for (const path of options.disallow ?? []) lines.push(`Disallow: ${path}`);
  }

  // Not with indexing off: an extra `Allow` rule for one crawler would let
  // that crawler back into a site the admin has closed to all of them.
  const extra = options.extra?.trim();
  if (extra && options.allowIndexing) lines.push("", extra);

  if (options.allowIndexing && options.sitemapUrl) {
    lines.push("", `Sitemap: ${options.sitemapUrl}`);
  }

  return `${lines.join("\n")}\n`;
}

/** schema.org Product with its Offer. */
export function productJsonLd(
  product: StorefrontProduct,
  context: { url: string; siteName: string; description?: string },
): Record<string, unknown> {
  const description =
    context.description ??
    product.seo.description ??
    (product.shortInfo ? htmlToPlainText(product.shortInfo, 5000) : undefined) ??
    (product.description ? htmlToPlainText(product.description, 5000) : undefined);

  const images = product.images.map((image) => image.url);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.sku,
    url: context.url,
    ...(description ? { description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    offers: {
      "@type": "Offer",
      url: context.url,
      // schema.org wants a decimal string, not minor units.
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: context.siteName },
    },
  };
}

/** schema.org BlogPosting for an article. */
export function articleJsonLd(
  post: StorefrontPost,
  context: { url: string; siteName: string; logoUrl?: string | null },
): Record<string, unknown> {
  const description =
    post.seo.description ??
    (post.excerpt ? htmlToPlainText(post.excerpt, 300) : undefined) ??
    (post.body ? htmlToPlainText(post.body, 300) : undefined);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    url: context.url,
    mainEntityOfPage: context.url,
    ...(description ? { description } : {}),
    ...(post.coverImageUrl ? { image: [post.coverImageUrl] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    publisher: {
      "@type": "Organization",
      name: context.siteName,
      ...(context.logoUrl ? { logo: { "@type": "ImageObject", url: context.logoUrl } } : {}),
    },
  };
}

/** schema.org BreadcrumbList. Items in order, root first. */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** schema.org Organization and WebSite, for the home page. */
export function siteJsonLd(
  site: StorefrontSite,
  siteUrl: string,
): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: site.siteName,
      url: siteUrl,
      ...(site.logoUrl ? { logo: site.logoUrl } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.siteName,
      url: siteUrl,
      // Lets search engines offer a search box for the site in results.
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${joinUrl(siteUrl, "/products")}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}
