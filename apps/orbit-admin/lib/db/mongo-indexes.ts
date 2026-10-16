import type { CreateIndexesOptions, IndexSpecification } from "mongodb";

import { mongoDb } from "./mongo";
import { COLLECTIONS } from "./mongo-collections";

/**
 * Index definitions — the MongoDB equivalent of the Postgres `uniqueIndex`/
 * `index` declarations, plus the lookup indexes the document model needs where
 * SQL used a join (media usage, category archives).
 *
 * `ensureIndexes()` is idempotent: `createIndex` with the same spec and name is
 * a no-op, so it is safe to run on every boot or as a deploy step. Unique
 * indexes are what replace the FK/unique *constraints* Postgres enforced;
 * referential cascade/set-null behaviour moves into application code.
 */

type IndexDef = {
  keys: IndexSpecification;
  options: CreateIndexesOptions;
};

const INDEXES: Record<string, IndexDef[]> = {
  [COLLECTIONS.users]: [
    // Emails are stored lowercased (validation), so a plain unique index is
    // equivalent to the Postgres `users_email_unique`.
    { keys: { email: 1 }, options: { unique: true, name: "users_email_unique" } },
  ],
  [COLLECTIONS.sessions]: [
    { keys: { userId: 1 }, options: { name: "sessions_user_id_idx" } },
  ],
  [COLLECTIONS.products]: [
    { keys: { sku: 1 }, options: { unique: true, name: "products_sku_unique" } },
    { keys: { slug: 1 }, options: { unique: true, name: "products_slug_unique" } },
    { keys: { status: 1 }, options: { name: "products_status_idx" } },
    // Gallery membership — "which products reference this asset" (media usage).
    { keys: { "media.mediaAssetId": 1 }, options: { name: "products_media_asset_idx" } },
    // Share image — the other half of media usage for products.
    {
      keys: { "content.meta.ogImageAssetId": 1 },
      options: { name: "products_og_image_idx" },
    },
    // Category archive listing.
    {
      keys: { "content.categories.categoryId": 1 },
      options: { name: "products_category_idx" },
    },
  ],
  [COLLECTIONS.productContentRevisions]: [
    {
      keys: { productId: 1, version: 1 },
      options: { unique: true, name: "product_content_revisions_product_version_unique" },
    },
    { keys: { productId: 1 }, options: { name: "product_content_revisions_product_id_idx" } },
  ],
  [COLLECTIONS.mediaAssets]: [
    { keys: { sha256: 1 }, options: { unique: true, name: "media_assets_sha256_unique" } },
    { keys: { createdAt: -1 }, options: { name: "media_assets_created_at_idx" } },
  ],
  [COLLECTIONS.categories]: [
    { keys: { slug: 1 }, options: { unique: true, name: "categories_slug_unique" } },
    { keys: { position: 1 }, options: { name: "categories_position_idx" } },
    { keys: { "meta.ogImageAssetId": 1 }, options: { name: "categories_og_image_idx" } },
  ],
  [COLLECTIONS.orders]: [
    { keys: { orderNumber: 1 }, options: { unique: true, name: "orders_order_number_unique" } },
    { keys: { createdAt: -1 }, options: { name: "orders_created_at_idx" } },
    { keys: { status: 1 }, options: { name: "orders_status_idx" } },
  ],
  [COLLECTIONS.posts]: [
    { keys: { slug: 1 }, options: { unique: true, name: "posts_slug_unique" } },
    { keys: { status: 1 }, options: { name: "posts_status_idx" } },
    { keys: { publishedAt: -1 }, options: { name: "posts_published_at_idx" } },
    { keys: { coverImageAssetId: 1 }, options: { name: "posts_cover_image_idx" } },
    { keys: { "meta.ogImageAssetId": 1 }, options: { name: "posts_og_image_idx" } },
  ],
  [COLLECTIONS.pages]: [
    { keys: { slug: 1 }, options: { unique: true, name: "pages_slug_unique" } },
    { keys: { status: 1 }, options: { name: "pages_status_idx" } },
    { keys: { "meta.ogImageAssetId": 1 }, options: { name: "pages_og_image_idx" } },
  ],
  // settings: keyed by `_id` (the setting key), so no extra index.
  [COLLECTIONS.auditLogs]: [
    { keys: { actorId: 1 }, options: { name: "audit_logs_actor_id_idx" } },
    { keys: { action: 1 }, options: { name: "audit_logs_action_idx" } },
    { keys: { createdAt: -1 }, options: { name: "audit_logs_created_at_idx" } },
  ],
};

/**
 * Create every index, idempotently. Safe to call repeatedly; MongoDB skips an
 * index that already exists with the same name and spec.
 */
export async function ensureIndexes(): Promise<void> {
  for (const [collectionName, defs] of Object.entries(INDEXES)) {
    const collection = mongoDb.collection(collectionName);
    for (const def of defs) {
      await collection.createIndex(def.keys, def.options);
    }
  }
}

/** The index names this module declares, per collection — for tests/inspection. */
export const INDEX_NAMES: Record<string, string[]> = Object.fromEntries(
  Object.entries(INDEXES).map(([name, defs]) => [
    name,
    defs.map((d) => d.options.name as string),
  ]),
);
