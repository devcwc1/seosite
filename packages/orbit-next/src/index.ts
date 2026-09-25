/**
 * `@orbit/next` — the single sanctioned data-access layer for Orbit content.
 *
 * Consumer apps (e.g. the storefront) MUST NOT talk to the database or hand-roll
 * their own API fetchers. They import this package instead, which owns the read
 * contract, the DTO shapes and the caching policy. Swapping the transport
 * (HTTP today, something else tomorrow) then never touches consumer code.
 */

export type StorefrontImage = {
  url: string;
  alt?: string;
  position: number;
};

/** How a product refers to a category: enough to label and link it. */
export type StorefrontProductCategory = {
  slug: string;
  name: string;
  isPrimary: boolean;
};

/**
 * A page's search and social settings, as an editor set them. Every field is
 * the editor's own value or null — fallbacks (the product name, the site
 * default image) are the consumer's decision, not baked in here, so a
 * storefront can tell "set" from "inherited".
 */
export type StorefrontSeo = {
  /** Editor-written title. Used as the whole title, not put in the template. */
  title: string | null;
  description: string | null;
  keywords: string | null;
  /** Share image, resolved to an origin the browser (and crawlers) can reach. */
  ogImageUrl: string | null;
  /** Ask search engines not to index this page. */
  noindex: boolean;
  /** Set only when the content canonically lives at another URL. */
  canonicalUrl: string | null;
};

/** A published product as seen by the public storefront. */
export type StorefrontProduct = {
  id: string;
  slug: string;
  sku: string;
  title: string;
  shortInfo: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  inStock: boolean;
  images: StorefrontImage[];
  categories: StorefrontProductCategory[];
  seo: StorefrontSeo;
  /** ISO timestamp of the last edit, for sitemap `lastmod`. */
  updatedAt: string;
};

export type OrbitClientOptions = {
  /**
   * Base URL of the Orbit content API (the admin app). Falls back to
   * `ORBIT_API_URL`, then to `http://localhost:3000`.
   */
  baseUrl?: string;
  /**
   * Origin the browser should load images from. Orbit returns root-relative
   * image paths (`/api/v1/media/file/<id>`), which only resolve on the admin's
   * own origin — a consumer app served from anywhere else must prefix them.
   *
   * Falls back to `ORBIT_ASSET_BASE_URL`, then to `baseUrl`. That default is
   * right in development, where the admin is directly reachable, but not in
   * production, where `baseUrl` is usually a private network address: set
   * `ORBIT_ASSET_BASE_URL` to the admin's public origin there.
   *
   * Pass an empty string once assets are served from the consumer's own origin
   * (e.g. a reverse proxy mapping the media path) to keep the paths relative.
   */
  assetBaseUrl?: string;
  /**
   * Shared secret for writes (`createOrder`). Falls back to
   * `ORBIT_WRITE_TOKEN`. Server-side only — never expose it to a browser.
   */
  writeToken?: string;
  /** Injectable fetch, mainly for testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Next.js ISR revalidation window in seconds. Defaults to 60. */
  revalidate?: number;
};

/**
 * A category archive page: its own URL, its own copy, its own SEO. Product
 * counts are of published products only.
 */
export type StorefrontCategory = {
  slug: string;
  name: string;
  description: string | null;
  seo: StorefrontSeo;
  position: number;
  productCount: number;
  /** ISO timestamp of the last edit, for sitemap `lastmod`. */
  updatedAt: string;
};

/** A published blog post as seen by the public storefront. */
export type StorefrontPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  /** Sanitised HTML body. */
  body: string | null;
  /** Cover image, resolved to an origin the browser can reach. */
  coverImageUrl: string | null;
  seo: StorefrontSeo;
  /** ISO timestamp, or null for a post that has never been published. */
  publishedAt: string | null;
  /** ISO timestamp of the last edit, for sitemap `lastmod`. */
  updatedAt: string;
};

/**
 * Site-wide search and social settings, controlled from the Orbit admin.
 * Pages use these wherever they have nothing more specific of their own.
 */
export type StorefrontSite = {
  siteName: string;
  /** Contains `%s`, replaced with a page's own title. */
  titleTemplate: string;
  /** Public origin, no trailing slash. Null when the admin has not set one. */
  siteUrl: string | null;
  defaultDescription: string | null;
  defaultOgImageUrl: string | null;
  logoUrl: string | null;
  /** Includes the @. */
  twitterHandle: string | null;
  /** False means every page is noindex and robots.txt disallows everything. */
  allowIndexing: boolean;
  /** Extra robots.txt lines, verbatim. */
  robotsExtra: string;
};

/** What a storefront sends to place an order. Deliberately no prices. */
export type OrderInput = {
  email: string;
  phone?: string;
  shipping: {
    name: string;
    street: string;
    postcode: string;
    city: string;
    /** ISO 3166-1 alpha-2. */
    country: string;
  };
  items: { slug: string; quantity: number }[];
};

/** What Orbit returns once an order is recorded. Every amount is Orbit's. */
export type OrderConfirmation = {
  orderNumber: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

export interface OrbitClient {
  listProducts(): Promise<StorefrontProduct[]>;
  getProduct(slug: string): Promise<StorefrontProduct | null>;
  listCategories(): Promise<StorefrontCategory[]>;
  getCategory(slug: string): Promise<StorefrontCategory | null>;
  /** Published blog posts, newest first. */
  listPosts(): Promise<StorefrontPost[]>;
  getPost(slug: string): Promise<StorefrontPost | null>;
  /** Site-wide search and social settings. */
  getSite(): Promise<StorefrontSite>;
  /**
   * Place an order. Server-side only: it presents the write token, which must
   * never reach a browser.
   */
  createOrder(input: OrderInput): Promise<OrderConfirmation>;
}

/** Thrown when the Orbit content API responds with a non-OK status. */
export class OrbitApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Orbit API responded ${status} for ${path}`);
    this.name = "OrbitApiError";
  }
}

/**
 * Thrown when Orbit refuses an order. `detail` is Orbit's own explanation
 * (a stale cart, an out-of-stock line) and is safe to show a customer.
 */
export class OrbitOrderError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "OrbitOrderError";
  }
}

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_REVALIDATE = 60;

/**
 * Resolve one Orbit asset path against the asset origin. Root-relative paths
 * only; absolute URLs (external backfills) are already reachable.
 */
function resolveAssetUrl(url: string | null, assetBaseUrl: string): string | null {
  if (url === null || assetBaseUrl === "" || !url.startsWith("/")) return url;
  return `${assetBaseUrl}${url}`;
}

/**
 * Share images must be absolute to be of any use: a social network fetching
 * a card cannot resolve a path against the admin's private address.
 */
function withResolvedSeo<T extends { seo: StorefrontSeo }>(
  item: T,
  assetBaseUrl: string,
): T {
  return {
    ...item,
    seo: { ...item.seo, ogImageUrl: resolveAssetUrl(item.seo.ogImageUrl, assetBaseUrl) },
  };
}

/**
 * Point a product's images at an origin the browser can actually reach. Only
 * root-relative paths are rewritten; absolute URLs (images backfilled from an
 * external source) are already resolvable and are left untouched.
 */
function withResolvedImages(
  product: StorefrontProduct,
  assetBaseUrl: string,
): StorefrontProduct {
  if (assetBaseUrl === "") return product;

  return withResolvedSeo(
    {
      ...product,
      images: product.images.map((image) =>
        image.url.startsWith("/")
          ? { ...image, url: `${assetBaseUrl}${image.url}` }
          : image,
      ),
    },
    assetBaseUrl,
  );
}

/**
 * Create an Orbit content client. This is the only supported way for a
 * consumer app to read Orbit data.
 */
export function createOrbitClient(
  options: OrbitClientOptions = {},
): OrbitClient {
  const baseUrl = (
    options.baseUrl ??
    process.env.ORBIT_API_URL ??
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const assetBaseUrl = (
    options.assetBaseUrl ??
    process.env.ORBIT_ASSET_BASE_URL ??
    baseUrl
  ).replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const revalidate = options.revalidate ?? DEFAULT_REVALIDATE;

  async function request<T>(path: string): Promise<T> {
    // `next.revalidate` is honoured by the Next.js fetch and ignored elsewhere.
    const response = await doFetch(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate },
    } as RequestInit & { next: { revalidate: number } });

    if (!response.ok) {
      throw new OrbitApiError(response.status, path);
    }

    return (await response.json()) as T;
  }

  return {
    async listProducts() {
      const products = await request<StorefrontProduct[]>(
        "/api/storefront/products",
      );
      return products.map((product) =>
        withResolvedImages(product, assetBaseUrl),
      );
    },
    async getProduct(slug: string) {
      try {
        const product = await request<StorefrontProduct>(
          `/api/storefront/products/${encodeURIComponent(slug)}`,
        );
        return withResolvedImages(product, assetBaseUrl);
      } catch (error) {
        if (error instanceof OrbitApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },

    async listCategories() {
      const categories = await request<StorefrontCategory[]>(
        "/api/storefront/categories",
      );
      return categories.map((category) => withResolvedSeo(category, assetBaseUrl));
    },

    async getCategory(slug: string) {
      try {
        const category = await request<StorefrontCategory>(
          `/api/storefront/categories/${encodeURIComponent(slug)}`,
        );
        return withResolvedSeo(category, assetBaseUrl);
      } catch (error) {
        if (error instanceof OrbitApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },

    async listPosts() {
      const posts = await request<StorefrontPost[]>("/api/storefront/posts");
      return posts.map((post) => ({
        ...withResolvedSeo(post, assetBaseUrl),
        coverImageUrl: resolveAssetUrl(post.coverImageUrl, assetBaseUrl),
      }));
    },

    async getPost(slug: string) {
      try {
        const post = await request<StorefrontPost>(
          `/api/storefront/posts/${encodeURIComponent(slug)}`,
        );
        return {
          ...withResolvedSeo(post, assetBaseUrl),
          coverImageUrl: resolveAssetUrl(post.coverImageUrl, assetBaseUrl),
        };
      } catch (error) {
        if (error instanceof OrbitApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },

    async getSite() {
      const site = await request<StorefrontSite>("/api/storefront/site");
      return {
        ...site,
        defaultOgImageUrl: resolveAssetUrl(site.defaultOgImageUrl, assetBaseUrl),
        logoUrl: resolveAssetUrl(site.logoUrl, assetBaseUrl),
      };
    },

    async createOrder(input: OrderInput) {
      const token = options.writeToken ?? process.env.ORBIT_WRITE_TOKEN;
      if (!token) {
        throw new OrbitOrderError(
          503,
          "Ordering is not configured for this storefront.",
        );
      }

      const response = await doFetch(`${baseUrl}/api/v1/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
        cache: "no-store",
      });

      if (!response.ok) {
        // Orbit answers with problem+json; `detail` is written for a customer.
        const problem = (await response
          .json()
          .catch(() => null)) as { detail?: string } | null;

        throw new OrbitOrderError(
          response.status,
          problem?.detail ?? "The order could not be placed.",
        );
      }

      return (await response.json()) as OrderConfirmation;
    },
  };
}
