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
    shortInfo: varchar("short_info", { length: 512 }),
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
/*  media (asset library — uploaded files, reusable across the app)            */
/* -------------------------------------------------------------------------- */

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
