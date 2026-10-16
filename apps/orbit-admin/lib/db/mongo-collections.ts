import type { Collection } from "mongodb";

import { mongoDb } from "./mongo";
import type {
  OrderStatus,
  PageStatus,
  PostStatus,
  ProductCategory,
  ProductContentSnapshot,
  ProductImage,
  ProductMeta,
  ProductReview,
  ProductStatus,
  UserStatusValue,
} from "./schema";

/**
 * The MongoDB document model (migration in progress).
 *
 * One collection per aggregate. Where the Postgres schema normalised a 1:1 or
 * ownership relationship into a separate table, the document model embeds it:
 * a product carries its current content and gallery, an order carries its line
 * items. True entities that are referenced from many places — users, media
 * assets, categories — stay their own collections and are referenced by id.
 *
 * Ids are the same string UUIDs the Postgres rows used (and the sha256 string
 * for sessions), kept as `_id` so existing identifiers and URLs are preserved.
 * Timestamps are native `Date`s. The shared JSON shapes (ProductImage, …) are
 * reused verbatim from the Drizzle schema so the two never drift.
 */

type UserRoleValue = "admin" | "editor" | "viewer";

export const COLLECTIONS = {
  users: "users",
  sessions: "sessions",
  products: "products",
  productContentRevisions: "product_content_revisions",
  mediaAssets: "media_assets",
  categories: "categories",
  orders: "orders",
  posts: "posts",
  pages: "pages",
  settings: "settings",
  auditLogs: "audit_logs",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/* -------------------------------------------------------------------------- */
/*  Embedded shapes                                                            */
/* -------------------------------------------------------------------------- */

/** A category assignment embedded on a product — the slug/name denormalised
 *  for display, plus the category id for referential lookups. */
export type ProductCategoryRef = ProductCategory & { categoryId: string };

/** A gallery link embedded on a product (was the `product_media` join). */
export type ProductMediaRef = {
  mediaAssetId: string;
  position: number;
  alt: string | null;
};

/** The product's current, editable content, embedded in the product document. */
export type EmbeddedProductContent = {
  title: string;
  shortInfo: string | null;
  description: string | null;
  images: ProductImage[];
  categories: ProductCategoryRef[];
  meta: ProductMeta;
  reviews: ProductReview[];
  locale: string;
  /** Mirrors the latest revision's version. */
  version: number;
};

/* -------------------------------------------------------------------------- */
/*  Document types                                                             */
/* -------------------------------------------------------------------------- */

export type UserDoc = {
  _id: string;
  email: string;
  passwordHash: string;
  role: UserRoleValue;
  status: UserStatusValue;
  mfaEnforced: boolean;
  mfaEnrolled: boolean;
  createdAt: Date;
};

export type SessionDoc = {
  /** sha256 of the cookie token. */
  _id: string;
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

export type ProductDoc = {
  _id: string;
  sku: string;
  slug: string;
  status: ProductStatus;
  priceCents: number;
  currency: string;
  inStock: boolean;
  stockQuantity: number;
  /** Current editable content (was the `product_content` row). */
  content: EmbeddedProductContent;
  /** Ordered gallery of media-library assets (was `product_media`). */
  media: ProductMediaRef[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductContentRevisionDoc = {
  _id: string;
  productId: string;
  version: number;
  data: ProductContentSnapshot;
  changeNote: string | null;
  editedBy: string | null;
  createdAt: Date;
};

export type MediaAssetDoc = {
  _id: string;
  sha256: string;
  storageKey: string | null;
  externalUrl: string | null;
  thumbKey: string | null;
  format: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalName: string | null;
  originalMimeType: string | null;
  title: string | null;
  alt: string | null;
  /** Soft delete; the row and file stay, the library stops listing it. */
  deletedAt: Date | null;
  uploadedBy: string | null;
  createdAt: Date;
};

export type CategoryDoc = {
  _id: string;
  slug: string;
  name: string;
  description: string | null;
  meta: ProductMeta;
  position: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A line item embedded on an order — a snapshot that survives catalog edits. */
export type EmbeddedOrderItem = {
  /** Kept for reporting; nullable and never trusted for display. */
  productId: string | null;
  title: string;
  sku: string;
  slug: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type OrderDoc = {
  _id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  phone: string | null;
  shipping: {
    name: string;
    street: string;
    postcode: string;
    city: string;
    /** ISO 3166-1 alpha-2. */
    country: string;
  };
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  taxRateBp: number;
  paymentMethod: string;
  items: EmbeddedOrderItem[];
  createdAt: Date;
};

export type PostDoc = {
  _id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  coverImageAssetId: string | null;
  status: PostStatus;
  publishedAt: Date | null;
  meta: ProductMeta;
  authorId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PageDoc = {
  _id: string;
  slug: string;
  title: string;
  content: string | null;
  status: PageStatus;
  meta: ProductMeta;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SettingDoc = {
  /** The setting key. */
  _id: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
};

export type AuditLogDoc = {
  _id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

/* -------------------------------------------------------------------------- */
/*  Typed collection accessors                                                 */
/* -------------------------------------------------------------------------- */

export const usersCollection = (): Collection<UserDoc> =>
  mongoDb.collection<UserDoc>(COLLECTIONS.users);
export const sessionsCollection = (): Collection<SessionDoc> =>
  mongoDb.collection<SessionDoc>(COLLECTIONS.sessions);
export const productsCollection = (): Collection<ProductDoc> =>
  mongoDb.collection<ProductDoc>(COLLECTIONS.products);
export const productContentRevisionsCollection =
  (): Collection<ProductContentRevisionDoc> =>
    mongoDb.collection<ProductContentRevisionDoc>(
      COLLECTIONS.productContentRevisions,
    );
export const mediaAssetsCollection = (): Collection<MediaAssetDoc> =>
  mongoDb.collection<MediaAssetDoc>(COLLECTIONS.mediaAssets);
export const categoriesCollection = (): Collection<CategoryDoc> =>
  mongoDb.collection<CategoryDoc>(COLLECTIONS.categories);
export const ordersCollection = (): Collection<OrderDoc> =>
  mongoDb.collection<OrderDoc>(COLLECTIONS.orders);
export const postsCollection = (): Collection<PostDoc> =>
  mongoDb.collection<PostDoc>(COLLECTIONS.posts);
export const pagesCollection = (): Collection<PageDoc> =>
  mongoDb.collection<PageDoc>(COLLECTIONS.pages);
export const settingsCollection = (): Collection<SettingDoc> =>
  mongoDb.collection<SettingDoc>(COLLECTIONS.settings);
export const auditLogsCollection = (): Collection<AuditLogDoc> =>
  mongoDb.collection<AuditLogDoc>(COLLECTIONS.auditLogs);
