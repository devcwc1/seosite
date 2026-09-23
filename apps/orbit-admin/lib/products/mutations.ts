import "server-only";

import { eq, or } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import {
  getProductCategories,
  normalizeSelections,
  resolveCategorySnapshot,
  setProductCategories,
  type ProductCategorySelection,
} from "@/lib/categories/mutations";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { toStoredMeta } from "@/lib/seo/meta";
import { assetUrl, getProductGallery, setProductGallery } from "@/lib/media/assets";
import { db } from "@/lib/db";
import {
  mediaAssets,
  productContent,
  productContentRevisions,
  products,
  type ProductContentSnapshot,
  type ProductMeta,
  type ProductReview,
  type ProductStatus,
} from "@/lib/db/schema";

import type { ProductParsed } from "./validation";

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

/**
 * Description is rich text. It is sanitised here, on write, because this is
 * the last point the application controls before it is stored and later
 * rendered as HTML by the storefront.
 */
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

/** Category selections as `setProductCategories` wants them. */
function categorySelections(input: ProductParsed): ProductCategorySelection[] {
  return input.categories.map((entry) => ({
    categoryId: entry.categoryId,
    isPrimary: entry.isPrimary,
  }));
}

function galleryItems(input: ProductParsed): { assetId: string; alt: string | null }[] {
  return input.images.map((image) => ({
    assetId: image.assetId,
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
    // Images live in product_media now; the content snapshot no longer carries them.
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
  const rows = await db
    .select({ id: products.id, slug: products.slug, sku: products.sku })
    .from(products)
    .where(or(eq(products.slug, slug), eq(products.sku, sku)));

  const errors: Record<string, string> = {};
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue;
    if (row.slug === slug) errors.slug = "This slug is already in use.";
    if (row.sku === sku) errors.sku = "This SKU is already in use.";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function createProduct(
  input: ProductParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const conflicts = await findUniquenessErrors(input.slug, input.sku, null);
  if (conflicts) return { ok: false, errors: conflicts };

  const priceCents = Math.round(input.price * 100);
  const stockQuantity = input.inStock ? input.stockQuantity : 0;
  const meta = toMeta(input);
  const reviews = toReviews(input);
  const selections = normalizeSelections(categorySelections(input));

  const id = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        sku: input.sku,
        slug: input.slug,
        status: input.status,
        priceCents,
        currency: input.currency,
        inStock: input.inStock,
        stockQuantity,
        createdBy: actorId,
      })
      .returning({ id: products.id });
    if (!product) throw new Error("Failed to insert product");

    const [content] = await tx
      .insert(productContent)
      .values({
        productId: product.id,
        title: input.title,
        shortInfo: toShortInfo(input),
        description: toDescription(input),
        images: [],
        // Categories live in product_categories now, like images.
        categories: [],
        meta,
        reviews,
        locale: "en",
        version: 1,
        updatedBy: actorId,
      })
      .returning({ id: productContent.id });
    if (!content) throw new Error("Failed to insert product content");

    const categorySnapshot = await resolveCategorySnapshot(tx, selections);

    await tx.insert(productContentRevisions).values({
      contentId: content.id,
      productId: product.id,
      version: 1,
      data: buildSnapshot(input, meta, reviews, categorySnapshot, "en"),
      changeNote: "Created",
      editedBy: actorId,
    });

    await setProductGallery(tx, product.id, galleryItems(input));
    await setProductCategories(tx, product.id, selections);

    await tx
      .update(products)
      .set({ currentContentId: content.id })
      .where(eq(products.id, product.id));

    return product.id;
  });

  await recordAudit({
    actorId,
    action: "product.created",
    target: `product:${id}`,
    metadata: { sku: input.sku, slug: input.slug },
  });

  return { ok: true, id };
}

export async function updateProduct(
  id: string,
  input: ProductParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!existing) return { ok: false, errors: { form: "Product not found." } };

  const conflicts = await findUniquenessErrors(input.slug, input.sku, id);
  if (conflicts) return { ok: false, errors: conflicts };

  const priceCents = Math.round(input.price * 100);
  const stockQuantity = input.inStock ? input.stockQuantity : 0;
  const meta = toMeta(input);
  const reviews = toReviews(input);

  await db.transaction(async (tx) => {
    const [content] = await tx
      .select()
      .from(productContent)
      .where(eq(productContent.productId, id))
      .limit(1);

    const selections = normalizeSelections(categorySelections(input));
    const categorySnapshot = await resolveCategorySnapshot(tx, selections);
    const locale = content?.locale ?? "en";
    const nextVersion = (content?.version ?? 0) + 1;

    let contentId: string;
    if (content) {
      await tx
        .update(productContent)
        .set({
          title: input.title,
          shortInfo: toShortInfo(input),
          description: toDescription(input),
          images: [],
          categories: [],
          meta,
          reviews,
          version: nextVersion,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(productContent.id, content.id));
      contentId = content.id;
    } else {
      const [created] = await tx
        .insert(productContent)
        .values({
          productId: id,
          title: input.title,
          shortInfo: toShortInfo(input),
          description: toDescription(input),
          images: [],
          categories: [],
          meta,
          reviews,
          locale,
          version: nextVersion,
          updatedBy: actorId,
        })
        .returning({ id: productContent.id });
      if (!created) throw new Error("Failed to insert product content");
      contentId = created.id;
    }

    await tx.insert(productContentRevisions).values({
      contentId,
      productId: id,
      version: nextVersion,
      data: buildSnapshot(input, meta, reviews, categorySnapshot, locale),
      changeNote: "Updated",
      editedBy: actorId,
    });

    await setProductGallery(tx, id, galleryItems(input));
    await setProductCategories(tx, id, selections);

    await tx
      .update(products)
      .set({
        sku: input.sku,
        slug: input.slug,
        status: input.status,
        priceCents,
        currency: input.currency,
        inStock: input.inStock,
        stockQuantity,
        currentContentId: contentId,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));
  });

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
  const [existing] = await db
    .select({ sku: products.sku, slug: products.slug })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!existing) return { ok: false, errors: { form: "Product not found." } };

  // product_media, content and revisions cascade via their FKs to products.id.
  await db.delete(products).where(eq(products.id, id));

  await recordAudit({
    actorId,
    action: "product.deleted",
    target: `product:${id}`,
    metadata: { sku: existing.sku, slug: existing.slug },
  });

  return { ok: true, id };
}

/** Load a product + its live content (scalars), shaped for the edit form. */
export async function getProductForEdit(
  id: string,
): Promise<ProductEditData | null> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product) return null;

  const [content] = await db
    .select()
    .from(productContent)
    .where(eq(productContent.productId, id))
    .limit(1);

  const [gallery, categorySelections] = await Promise.all([
    getProductGallery(id),
    getProductCategories(id),
  ]);

  // The OG image is stored as an id. Resolving it here means the form shows
  // the picked image rather than an empty box that looks like nothing is set.
  const ogImageAssetId = content?.meta?.ogImageAssetId;
  let ogImageUrl = "";
  if (ogImageAssetId) {
    const [asset] = await db
      .select({ id: mediaAssets.id, externalUrl: mediaAssets.externalUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, ogImageAssetId))
      .limit(1);
    if (asset) ogImageUrl = assetUrl(asset);
  }

  return {
    id: product.id,
    title: content?.title ?? "",
    slug: product.slug,
    sku: product.sku,
    status: product.status,
    shortInfo: content?.shortInfo ?? "",
    description: content?.description ?? "",
    price: product.priceCents / 100,
    currency: product.currency,
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    images: gallery.map((item) => ({
      assetId: item.assetId,
      url: item.url,
      alt: item.alt ?? "",
    })),
    categories: categorySelections,
    meta: content?.meta ?? {},
    ogImageUrl,
    reviews: content?.reviews ?? [],
  };
}

