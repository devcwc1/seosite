import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Shared JSON shapes                                                         */
/* -------------------------------------------------------------------------- */

/** A single product image, stored inside `product_content.images`. */
export type ProductImage = {
  url: string;
  alt?: string;
  /** Zero-based display order. */
  position: number;
};

/**
 * A category assignment on a product. A product may have many categories, and
 * exactly one of them should carry `isPrimary: true` (enforced in application
 * logic, not the DB — categories live inline for now).
 */
export type ProductCategory = {
  slug: string;
  name: string;
  isPrimary: boolean;
};

/** SEO / meta details for a product. */
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
/*  Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const userRole = pgEnum("user_role", ["admin", "editor", "viewer"]);
export const productStatus = pgEnum("product_status", [
  "draft",
  "published",
  "archived",
]);
export const postStatus = pgEnum("post_status", ["draft", "published", "archived"]);

export type ProductStatus = (typeof productStatus.enumValues)[number];

/* -------------------------------------------------------------------------- */
/*  users                                                                      */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("editor"),
    /** Org policy requires this user to use MFA. */
    mfaEnforced: boolean("mfa_enforced").notNull().default(false),
    /** This user has completed MFA enrolment (e.g. registered a TOTP factor). */
    mfaEnrolled: boolean("mfa_enrolled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

/* -------------------------------------------------------------------------- */
/*  sessions                                                                   */
/* -------------------------------------------------------------------------- */

export const sessions = pgTable(
  "sessions",
  {
    /** Opaque, high-entropy session id (store only a hash of the cookie value). */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Whether this session has cleared the MFA challenge. A freshly created
     * session for an MFA-enforced user starts `false` until the factor is
     * verified.
     */
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/* -------------------------------------------------------------------------- */
/*  products (commerce / inventory core)                                       */
/* -------------------------------------------------------------------------- */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    status: productStatus("status").notNull().default("draft"),
    /** Price in the smallest currency unit (e.g. cents) to avoid float drift. */
    priceCents: integer("price_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    /** Whether the product is available to buy. Drives the storefront badge. */
    inStock: boolean("in_stock").notNull().default(true),
    /** On-hand stock counter; only meaningful while `inStock` is true. */
    stockQuantity: integer("stock_quantity").notNull().default(0),
    /**
     * Points at the live row in `product_content`. Nullable so a product can be
     * created before its first content revision exists. No DB-level FK is set to
     * avoid a circular constraint with `product_content.product_id`.
     */
    currentContentId: uuid("current_content_id"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_status_idx").on(table.status),
  ],
);

/* -------------------------------------------------------------------------- */
/*  product_content (editable, current content of a product)                   */
/* -------------------------------------------------------------------------- */

export const productContent = pgTable(
  "product_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    /** Short teaser / summary line shown on cards. */
    // Rich text (sanitised HTML), like description; text, not a short varchar.
    shortInfo: text("short_info"),
    /** Long-form description (may hold rich text / markdown). */
    description: text("description"),
    images: jsonb("images")
      .$type<ProductImage[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    categories: jsonb("categories")
      .$type<ProductCategory[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** SEO / meta details (title, description, keywords). */
    meta: jsonb("meta").$type<ProductMeta>().notNull().default(sql`'{}'::jsonb`),
    /** Customer reviews managed alongside the product content. */
    reviews: jsonb("reviews")
      .$type<ProductReview[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    locale: varchar("locale", { length: 10 }).notNull().default("de"),
    /** Monotonically increasing content version; mirrors latest revision. */
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One content row per product per locale.
    uniqueIndex("product_content_product_locale_unique").on(
      table.productId,
      table.locale,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/*  product_content_revisions (immutable edit history)                         */
/* -------------------------------------------------------------------------- */

export const productContentRevisions = pgTable(
  "product_content_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => productContent.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** Full snapshot of the content as it looked at this version. */
    data: jsonb("data").$type<ProductContentSnapshot>().notNull(),
    changeNote: varchar("change_note", { length: 512 }),
    editedBy: uuid("edited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_content_revisions_content_version_unique").on(
      table.contentId,
      table.version,
    ),
    index("product_content_revisions_product_id_idx").on(table.productId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  audit_logs                                                                 */
/* -------------------------------------------------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Who performed the action; null for system-generated events. */
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Machine-readable action, e.g. "product.updated", "user.created". */
    action: varchar("action", { length: 128 }).notNull(),
    /** Affected entity reference, e.g. "product:<uuid>". */
    target: varchar("target", { length: 255 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  settings (key/value application configuration)                             */
/* -------------------------------------------------------------------------- */

export const settings = pgTable("settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: varchar("description", { length: 512 }),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  media (DEPRECATED — pre-ORB-501 unhardened uploads)                        */
/* -------------------------------------------------------------------------- */

/**
 * Superseded by `media_assets` (ORB-501). The upload/serve routes and helpers
 * are gone; the table is kept only so existing rows survive until a follow-up
 * drop migration retires it along with the legacy `uploads` volume.
 *
 * @deprecated Use `mediaAssets`.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored filename on disk; also the last segment of the served URL. */
    filename: varchar("filename", { length: 255 }).notNull(),
    /** The uploader's original file name, for display. */
    originalName: varchar("original_name", { length: 512 }),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Pixel dimensions when known (nullable — not always detected). */
    width: integer("width"),
    height: integer("height"),
    /** Default alt text for the asset. */
    alt: varchar("alt", { length: 512 }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("media_filename_unique").on(table.filename),
    index("media_created_at_idx").on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  media_assets (ORB-501 — hardened, content-addressed, deduped image assets) */
/* -------------------------------------------------------------------------- */

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 (hex) of the original uploaded bytes — the dedupe key. */
    sha256: varchar("sha256", { length: 64 }).notNull(),
    /**
     * Content-addressed relative path inside the media volume, e.g.
     * `products/ab/cd/<uuid>.webp`. Null when the asset is an external URL
     * (only used by the non-destructive backfill of pre-existing images).
     */
    storageKey: varchar("storage_key", { length: 512 }),
    /** Set only for backfilled pre-existing external images (e.g. seed URLs). */
    externalUrl: varchar("external_url", { length: 2048 }),
    /**
     * Downscaled copy for grid cells. Null for assets uploaded before thumbs
     * existed, and for external backfills — the file route falls back to the
     * original, so nothing needs backfilling before this is useful.
     */
    thumbKey: varchar("thumb_key", { length: 512 }),
    /** Stored (re-encoded) format + mime — always webp for new uploads. */
    format: varchar("format", { length: 16 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Byte size of the stored (re-encoded) file. */
    sizeBytes: integer("size_bytes").notNull().default(0),
    originalName: varchar("original_name", { length: 512 }),
    originalMimeType: varchar("original_mime_type", { length: 128 }),
    /** Human-friendly display title for the asset (editable). */
    title: varchar("title", { length: 512 }),
    /** Default alt text for the asset (editable). */
    alt: varchar("alt", { length: 512 }),
    /**
     * Soft delete. The row and its file stay; the library stops listing it.
     *
     * Assets are shared, so a delete is never local to the person doing it —
     * and because dedupe is by sha256, re-uploading the same bytes would
     * otherwise collide with a row nobody can see. Keeping the row lets that
     * upload restore it instead of failing on a ghost.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_sha256_unique").on(table.sha256),
    index("media_assets_created_at_idx").on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  product_media (links products to media_assets, ordered gallery)            */
/* -------------------------------------------------------------------------- */

export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Restrict: an asset that is still linked to a product cannot be deleted.
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    /** Zero-based gallery position. */
    position: integer("position").notNull().default(0),
    /** Optional per-product alt override; falls back to the asset's alt. */
    alt: varchar("alt", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_media_product_asset_unique").on(
      table.productId,
      table.mediaAssetId,
    ),
    index("product_media_product_position_idx").on(
      table.productId,
      table.position,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/*  categories + product_categories (archive pages)                            */
/* -------------------------------------------------------------------------- */

/**
 * A category is a page in its own right, not just a label on a product: it has
 * a slug that is a URL, copy that introduces the archive, and its own SEO
 * meta. Products point at it through `product_categories`.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    /** Intro copy shown on the archive page, above the product grid. */
    description: text("description"),
    /** Overrides the derived <title>/<meta description> on the archive page. */
    meta: jsonb("meta").$type<ProductMeta>().notNull().default({}),
    /** Manual ordering for the nav; ties break on name. */
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_position_idx").on(table.position),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Cascade: unfiling a product is what deleting a category means.
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** Exactly one per product carries the label and the breadcrumb. */
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_categories_unique").on(
      table.productId,
      table.categoryId,
    ),
    index("product_categories_category_idx").on(table.categoryId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  orders + order_items (storefront checkout)                                 */
/* -------------------------------------------------------------------------- */

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "shipped",
  "cancelled",
]);

/* -------------------------------------------------------------------------- */
/*  Blog                                                                       */
/* -------------------------------------------------------------------------- */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /** Short summary for cards and the meta-description fallback. Plain text. */
    excerpt: text("excerpt"),
    /** The article body: sanitised rich text (HTML), like a product description. */
    body: text("body"),
    /** Optional lead image, a media_assets row (ORB-501). */
    coverImageAssetId: uuid("cover_image_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    status: postStatus("status").notNull().default("draft"),
    /** Set the first time the post is published; drives ordering and sitemap lastmod. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Per-page search/social overrides, same shape as products and categories. */
    meta: jsonb("meta").$type<ProductMeta>().notNull().default({}),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("posts_slug_unique").on(table.slug),
    index("posts_status_idx").on(table.status),
    index("posts_published_at_idx").on(table.publishedAt),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-readable reference shown to the customer, e.g. ORB-2026-4KJ21P. */
    orderNumber: varchar("order_number", { length: 32 }).notNull(),
    /**
     * `pending` means recorded but unpaid: no payment provider is wired up, so
     * nothing can legitimately reach `paid` on its own yet.
     */
    status: orderStatus("status").notNull().default("pending"),

    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }),

    shippingName: varchar("shipping_name", { length: 255 }).notNull(),
    shippingStreet: varchar("shipping_street", { length: 255 }).notNull(),
    shippingPostcode: varchar("shipping_postcode", { length: 32 }).notNull(),
    shippingCity: varchar("shipping_city", { length: 128 }).notNull(),
    shippingCountry: varchar("shipping_country", { length: 2 }).notNull(),

    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    /**
     * Money as charged, in the smallest unit. Stored rather than recomputed so
     * an order stays exactly what the customer agreed to, whatever later
     * happens to catalog prices, tax rates or shipping costs.
     */
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    /** Tax rate applied, in basis points (900 = 9%). */
    taxRateBp: integer("tax_rate_bp").notNull().default(0),

    /** Placeholder until a payment provider is integrated. */
    paymentMethod: varchar("payment_method", { length: 32 })
      .notNull()
      .default("none"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique").on(table.orderNumber),
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_status_idx").on(table.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /**
     * Kept for reporting, but nullable and never trusted for display: a product
     * can be deleted long after the order it appears in.
     */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),

    /** Snapshot of what was bought, so the line survives catalog edits. */
    title: varchar("title", { length: 512 }).notNull(),
    sku: varchar("sku", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

/* -------------------------------------------------------------------------- */
/*  Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [products.createdBy],
    references: [users.id],
  }),
  content: many(productContent),
  revisions: many(productContentRevisions),
}));

export const productContentRelations = relations(
  productContent,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productContent.productId],
      references: [products.id],
    }),
    updatedByUser: one(users, {
      fields: [productContent.updatedBy],
      references: [users.id],
    }),
    revisions: many(productContentRevisions),
  }),
);

export const productContentRevisionsRelations = relations(
  productContentRevisions,
  ({ one }) => ({
    content: one(productContent, {
      fields: [productContentRevisions.contentId],
      references: [productContent.id],
    }),
    product: one(products, {
      fields: [productContentRevisions.productId],
      references: [products.id],
    }),
    editedByUser: one(users, {
      fields: [productContentRevisions.editedBy],
      references: [users.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [mediaAssets.uploadedBy],
    references: [users.id],
  }),
  productLinks: many(productMedia),
}));

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, {
    fields: [productMedia.productId],
    references: [products.id],
  }),
  asset: one(mediaAssets, {
    fields: [productMedia.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  coverImage: one(mediaAssets, {
    fields: [posts.coverImageAssetId],
    references: [mediaAssets.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [media.uploadedBy],
    references: [users.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductContentRow = typeof productContent.$inferSelect;
export type NewProductContent = typeof productContent.$inferInsert;
export type ProductContentRevision =
  typeof productContentRevisions.$inferSelect;
export type NewProductContentRevision =
  typeof productContentRevisions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type ProductCategoryLink = typeof productCategories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostStatus = (typeof postStatus.enumValues)[number];
