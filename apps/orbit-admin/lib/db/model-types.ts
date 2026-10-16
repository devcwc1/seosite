/**
 * Shared domain types for the MongoDB data model.
 *
 * These were originally inferred from the Drizzle/Postgres schema; with Postgres
 * removed they live here as plain TypeScript, free of any ORM. The document
 * types in `mongo-collections.ts` build on these, and the app imports them from
 * here instead of the old `./schema`.
 */

/* -------------------------------------------------------------------------- */
/*  Status enums (value lists + the unions derived from them)                  */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = ["admin", "editor", "viewer"] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

/**
 * Whether an account may authenticate at all. `disabled` is checked on every
 * request (ORB-203): a disabled user's live sessions are revoked and no new
 * one validates, so access ends without waiting for a cookie to expire.
 */
export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = ["pending", "paid", "shipped", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const POST_STATUSES = ["draft", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const PAGE_STATUSES = ["draft", "published", "archived"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Shared JSON shapes                                                         */
/* -------------------------------------------------------------------------- */

/** A single product image. */
export type ProductImage = {
  url: string;
  alt?: string;
  /** Zero-based display order. */
  position: number;
};

/**
 * A category assignment on a product. A product may have many categories, and
 * exactly one is primary (drives breadcrumbs and the canonical URL).
 */
export type ProductCategory = {
  slug: string;
  name: string;
  isPrimary: boolean;
};

/** SEO / meta details for a product, category, post or page. */
export type ProductMeta = {
  title?: string;
  description?: string;
  keywords?: string;
  /**
   * Open Graph image, chosen from the media library. Stored as an asset id
   * rather than a URL so the image stays a library asset — counted in its
   * usage, and protected by the same delete rules as a gallery image.
   */
  ogImageAssetId?: string;
  /** Ask search engines not to index the page. Absent means indexable. */
  noindex?: boolean;
  /** Absolute URL, set only when the content canonically lives elsewhere. */
  canonicalUrl?: string;
};

/** A single customer review authored/managed in the admin. */
export type ProductReview = {
  id: string;
  author: string;
  /** 1–5 stars. */
  rating: number;
  title?: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
};

/** Immutable snapshot of a product's content at a given revision. */
export type ProductContentSnapshot = {
  title: string;
  shortInfo: string | null;
  description: string | null;
  images: ProductImage[];
  categories: ProductCategory[];
  meta: ProductMeta;
  reviews: ProductReview[];
  locale: string;
};

/* -------------------------------------------------------------------------- */
/*  Auth entities (the id-based shape the app has always used)                 */
/* -------------------------------------------------------------------------- */

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRoleValue;
  status: UserStatusValue;
  mfaEnforced: boolean;
  mfaEnrolled: boolean;
  createdAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  mfaVerified: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  /** Sliding idle expiry, bumped on activity. */
  expiresAt: Date;
  /** Hard cap, fixed at creation. */
  absoluteExpiresAt: Date;
  /** Non-null means revoked (authoritative). */
  revokedAt: Date | null;
  createdAt: Date;
};
