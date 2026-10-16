import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import {
  categorySnapshotFromRefs,
  getProductCategories,
  normalizeSelections,
  resolveCategoryRefs,
  type ProductCategorySelection,
} from "@/lib/categories/mutations";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { mongoClient } from "@/lib/db/mongo";
import {
  mediaAssetsCollection,
  productContentRevisionsCollection,
  productsCollection,
  type EmbeddedProductContent,
  type ProductContentRevisionDoc,
  type ProductDoc,
  type ProductMediaRef,
} from "@/lib/db/mongo-collections";
import {
  type ProductContentSnapshot,
  type ProductMeta,
  type ProductReview,
  type ProductStatus,
} from "@/lib/db/schema";
import { assetUrl, getProductGallery } from "@/lib/media/assets";
import { toStoredMeta } from "@/lib/seo/meta";

import type { ProductParsed } from "./validation";

/**
 * Products live in MongoDB. A product document embeds its current content, its
 * ordered media gallery (`media`), and its category refs (`content.categories`)
 * — the Postgres product_content / product_media / product_categories tables
 * are gone. Each save also appends an immutable revision. Media asset URLs for
 * the edit form are resolved from the media_assets collection.
 */

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** Everything the edit form needs to prefill, gallery included. */
export type ProductEditData = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  status: ProductStatus;
  shortInfo: string;
  description: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockQuantity: number;
  images: { assetId: string; url: string; alt: string }[];
  categories: ProductCategorySelection[];
  meta: ProductMeta;
  /** Served URL for meta.ogImageAssetId, so the form can show the choice. */
  ogImageUrl: string;
  reviews: ProductReview[];
};

/** Description is rich text; sanitised on write, the last point we control. */
function toDescription(input: ProductParsed): string | null {
  return sanitizeRichText(input.description) || null;
}

/** Short description is rich text too, sanitised on the same boundary. */
function toShortInfo(input: ProductParsed): string | null {
  return sanitizeRichText(input.shortInfo) || null;
}

function toMeta(input: ProductParsed): ProductMeta {
  return toStoredMeta(input.meta);
}

function toReviews(input: ProductParsed): ProductReview[] {
  return input.reviews.map((review) => ({
    id: review.id,
    author: review.author,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt,
    ...(review.title ? { title: review.title } : {}),
  }));
}

function categorySelections(input: ProductParsed): ProductCategorySelection[] {
  return input.categories.map((entry) => ({
    categoryId: entry.categoryId,
    isPrimary: entry.isPrimary,
  }));
}

/** Ordered gallery refs from the form's image selections. */
function galleryRefs(input: ProductParsed): ProductMediaRef[] {
  return input.images.map((image, index) => ({
    mediaAssetId: image.assetId,
    position: index,
    alt: image.alt || null,
  }));
}

function buildSnapshot(
  input: ProductParsed,
  meta: ProductMeta,
  reviews: ProductReview[],
  categories: ProductContentSnapshot["categories"],
  locale: string,
): ProductContentSnapshot {
  return {
    title: input.title,
    shortInfo: toShortInfo(input),
    description: toDescription(input),
    // Images live in the product's `media` array now; the snapshot omits them.
    images: [],
    categories,
    meta,
    reviews,
    locale,
  };
}

/** Return { slug?, sku? } errors for values already used by another product. */
async function findUniquenessErrors(
  slug: string,
  sku: string,
  excludeId: string | null,
): Promise<Record<string, string> | null> {
  const rows = await productsCollection()
    .find({ $or: [{ slug }, { sku }] }, { projection: { slug: 1, sku: 1 } })
    .toArray();

  const errors: Record<string, string> = {};
  for (const row of rows) {
    if (excludeId && row._id === excludeId) continue;
    if (row.slug === slug) errors.slug = "This slug is already in use.";
    if (row.sku === sku) errors.sku = "This SKU is already in use.";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/** Write the product document and its revision atomically. */
async function writeProductWithRevision(
  op: (session: import("mongodb").ClientSession) => Promise<void>,
): Promise<void> {
  const session = mongoClient.startSession();
  try {
    await session.withTransaction(() => op(session));
  } finally {
    await session.endSession();
  }
}

export async function createProduct(
  input: ProductParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const conflicts = await findUniquenessErrors(input.slug, input.sku, null);
  if (conflicts) return { ok: false, errors: conflicts };

  const now = new Date();
  const meta = toMeta(input);
  const reviews = toReviews(input);
  const categoryRefs = await resolveCategoryRefs(categorySelections(input));

  const content: EmbeddedProductContent = {
    title: input.title,
    shortInfo: toShortInfo(input),
    description: toDescription(input),
    images: [],
    categories: categoryRefs,
    meta,
    reviews,
    locale: "en",
    version: 1,
  };

  const product: ProductDoc = {
    _id: randomUUID(),
    sku: input.sku,
    slug: input.slug,
    status: input.status,
    priceCents: Math.round(input.price * 100),
    currency: input.currency,
    inStock: input.inStock,
    stockQuantity: input.inStock ? input.stockQuantity : 0,
    content,
    media: galleryRefs(input),
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const revision: ProductContentRevisionDoc = {
    _id: randomUUID(),
    productId: product._id,
    version: 1,
    data: buildSnapshot(input, meta, reviews, categorySnapshotFromRefs(categoryRefs), "en"),
    changeNote: "Created",
    editedBy: actorId,
    createdAt: now,
  };

  try {
    await writeProductWithRevision(async (session) => {
      await productsCollection().insertOne(product, { session });
      await productContentRevisionsCollection().insertOne(revision, { session });
    });
  } catch {
    return { ok: false, errors: { form: "Could not create the product." } };
  }

  await recordAudit({
    actorId,
    action: "product.created",
    target: `product:${product._id}`,
    metadata: { sku: input.sku, slug: input.slug },
  });

  return { ok: true, id: product._id };
}

export async function updateProduct(
  id: string,
  input: ProductParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const existing = await productsCollection().findOne(
    { _id: id },
    { projection: { "content.version": 1, "content.locale": 1 } },
  );
  if (!existing) return { ok: false, errors: { form: "Product not found." } };

  const conflicts = await findUniquenessErrors(input.slug, input.sku, id);
  if (conflicts) return { ok: false, errors: conflicts };

  const now = new Date();
  const meta = toMeta(input);
  const reviews = toReviews(input);
  const categoryRefs = await resolveCategoryRefs(categorySelections(input));
  const locale = existing.content?.locale ?? "en";
  const nextVersion = (existing.content?.version ?? 0) + 1;

  const content: EmbeddedProductContent = {
    title: input.title,
    shortInfo: toShortInfo(input),
    description: toDescription(input),
    images: [],
    categories: categoryRefs,
    meta,
    reviews,
    locale,
    version: nextVersion,
  };

  const revision: ProductContentRevisionDoc = {
    _id: randomUUID(),
    productId: id,
    version: nextVersion,
    data: buildSnapshot(input, meta, reviews, categorySnapshotFromRefs(categoryRefs), locale),
    changeNote: "Updated",
    editedBy: actorId,
    createdAt: now,
  };

  try {
    await writeProductWithRevision(async (session) => {
      await productsCollection().updateOne(
        { _id: id },
        {
          $set: {
            sku: input.sku,
            slug: input.slug,
            status: input.status,
            priceCents: Math.round(input.price * 100),
            currency: input.currency,
            inStock: input.inStock,
            stockQuantity: input.inStock ? input.stockQuantity : 0,
            content,
            media: galleryRefs(input),
            updatedBy: actorId,
            updatedAt: now,
          },
        },
        { session },
      );
      await productContentRevisionsCollection().insertOne(revision, { session });
    });
  } catch {
    return { ok: false, errors: { form: "Could not update the product." } };
  }

  await recordAudit({
    actorId,
    action: "product.updated",
    target: `product:${id}`,
    metadata: { sku: input.sku, slug: input.slug },
  });

  return { ok: true, id };
}

export async function deleteProduct(
  id: string,
  actorId: string | null,
): Promise<MutationResult> {
  const existing = await productsCollection().findOne(
    { _id: id },
    { projection: { sku: 1, slug: 1 } },
  );
  if (!existing) return { ok: false, errors: { form: "Product not found." } };

  // Content and gallery are embedded (gone with the doc); revisions are their
  // own collection, so they are removed explicitly.
  await productsCollection().deleteOne({ _id: id });
  await productContentRevisionsCollection().deleteMany({ productId: id });

  await recordAudit({
    actorId,
    action: "product.deleted",
    target: `product:${id}`,
    metadata: { sku: existing.sku, slug: existing.slug },
  });

  return { ok: true, id };
}

/** Load a product shaped for the edit form, gallery included. */
export async function getProductForEdit(
  id: string,
): Promise<ProductEditData | null> {
  const product = await productsCollection().findOne({ _id: id });
  if (!product) return null;

  const [gallery, categories] = await Promise.all([
    getProductGallery(id),
    getProductCategories(id),
  ]);

  // The OG image is stored as an id; resolve it so the form shows the choice.
  const ogImageAssetId = product.content.meta?.ogImageAssetId;
  let ogImageUrl = "";
  if (ogImageAssetId) {
    const asset = await mediaAssetsCollection().findOne(
      { _id: ogImageAssetId },
      { projection: { externalUrl: 1 } },
    );
    if (asset) ogImageUrl = assetUrl({ id: asset._id, externalUrl: asset.externalUrl });
  }

  return {
    id: product._id,
    title: product.content.title,
    slug: product.slug,
    sku: product.sku,
    status: product.status,
    shortInfo: product.content.shortInfo ?? "",
    description: product.content.description ?? "",
    price: product.priceCents / 100,
    currency: product.currency,
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    images: gallery.map((item) => ({
      assetId: item.assetId,
      url: item.url,
      alt: item.alt ?? "",
    })),
    categories,
    meta: product.content.meta ?? {},
    ogImageUrl,
    reviews: product.content.reviews ?? [],
  };
}
