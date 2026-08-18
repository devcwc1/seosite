import "server-only";

import { eq, or } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
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

/** Data shape used to prefill the edit form. */
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
  meta: ProductMeta;
  reviews: ProductReview[];
};

function toMeta(input: ProductParsed): ProductMeta {
  const meta: ProductMeta = {};
  if (input.meta.title) meta.title = input.meta.title;
  if (input.meta.description) meta.description = input.meta.description;
  if (input.meta.keywords) meta.keywords = input.meta.keywords;
  return meta;
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

function buildSnapshot(
  input: ProductParsed,
  meta: ProductMeta,
  reviews: ProductReview[],
  images: ProductContentSnapshot["images"],
  categories: ProductContentSnapshot["categories"],
  locale: string,
): ProductContentSnapshot {
  return {
    title: input.title,
    shortInfo: input.shortInfo || null,
    description: input.description || null,
    images,
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
        shortInfo: input.shortInfo || null,
        description: input.description || null,
        images: [],
        categories: [],
        meta,
        reviews,
        locale: "en",
        version: 1,
        updatedBy: actorId,
      })
      .returning({ id: productContent.id });
    if (!content) throw new Error("Failed to insert product content");

    await tx.insert(productContentRevisions).values({
      contentId: content.id,
      productId: product.id,
      version: 1,
      data: buildSnapshot(input, meta, reviews, [], [], "en"),
      changeNote: "Created",
      editedBy: actorId,
    });

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

    // Preserve fields not managed by this form.
    const images = content?.images ?? [];
    const categories = content?.categories ?? [];
    const locale = content?.locale ?? "en";
    const nextVersion = (content?.version ?? 0) + 1;

    let contentId: string;
    if (content) {
      await tx
        .update(productContent)
        .set({
          title: input.title,
          shortInfo: input.shortInfo || null,
          description: input.description || null,
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
          shortInfo: input.shortInfo || null,
          description: input.description || null,
          images,
          categories,
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
      data: buildSnapshot(input, meta, reviews, images, categories, locale),
      changeNote: "Updated",
      editedBy: actorId,
    });

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

  // Content + revisions cascade via their FKs to products.id.
  await db.delete(products).where(eq(products.id, id));

  await recordAudit({
    actorId,
    action: "product.deleted",
    target: `product:${id}`,
    metadata: { sku: existing.sku, slug: existing.slug },
  });

  return { ok: true, id };
}

/** Load a product + its live content, shaped for the edit form. */
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
    meta: content?.meta ?? {},
    reviews: content?.reviews ?? [],
  };
}
