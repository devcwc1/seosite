import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import {
  categoriesCollection,
  productsCollection,
  type CategoryDoc,
  type ProductCategoryRef,
} from "@/lib/db/mongo-collections";
import type { ProductMeta } from "@/lib/db/schema";
import { toStoredMeta } from "@/lib/seo/meta";

import type { CategoryParsed } from "./validation";

/**
 * Categories live in MongoDB. A product embeds a denormalised category ref
 * ({categoryId, slug, name, isPrimary}) in `content.categories`, so the old
 * product_categories join is gone — "which products are in a category" is a
 * query over the product documents.
 */

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

export type CategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  meta: ProductMeta;
  position: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryWithCount = CategoryRecord & { productCount: number };

function toCategoryRecord(doc: CategoryDoc): CategoryRecord {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    meta: doc.meta,
    position: doc.position,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toMeta(input: CategoryParsed): ProductMeta {
  return toStoredMeta(input.meta);
}

/** How many products reference each category, keyed by category id. */
async function productCountsByCategory(): Promise<Map<string, number>> {
  const rows = await productsCollection()
    .aggregate([
      { $unwind: "$content.categories" },
      { $group: { _id: "$content.categories.categoryId", n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id as string, r.n as number]));
}

/** Ordered as the storefront nav shows them: position, then name. */
export async function listCategories(): Promise<CategoryWithCount[]> {
  const [docs, counts] = await Promise.all([
    categoriesCollection().find({}).sort({ position: 1, name: 1 }).toArray(),
    productCountsByCategory(),
  ]);

  return docs.map((doc) => ({
    ...toCategoryRecord(doc),
    productCount: counts.get(doc._id) ?? 0,
  }));
}

export async function getCategory(id: string): Promise<CategoryRecord | null> {
  const doc = await categoriesCollection().findOne({ _id: id });
  return doc ? toCategoryRecord(doc) : null;
}

async function slugTaken(slug: string, excludeId: string | null) {
  const row = await categoriesCollection().findOne(
    excludeId ? { slug, _id: { $ne: excludeId } } : { slug },
    { projection: { _id: 1 } },
  );
  return row !== null;
}

export async function createCategory(
  input: CategoryParsed,
  actorId: string | null,
): Promise<MutationResult> {
  if (await slugTaken(input.slug, null)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  const now = new Date();
  const doc: CategoryDoc = {
    _id: randomUUID(),
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    meta: toMeta(input),
    position: input.position,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await categoriesCollection().insertOne(doc);
  } catch {
    return { ok: false, errors: { form: "Could not create category." } };
  }

  await recordAudit({
    actorId,
    action: "category.created",
    target: `category:${doc._id}`,
    metadata: { slug: input.slug, name: input.name },
  });

  return { ok: true, id: doc._id };
}

export async function updateCategory(
  id: string,
  input: CategoryParsed,
  actorId: string | null,
): Promise<MutationResult> {
  const existing = await getCategory(id);
  if (!existing) return { ok: false, errors: { form: "Category not found." } };

  if (await slugTaken(input.slug, id)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  await categoriesCollection().updateOne(
    { _id: id },
    {
      $set: {
        slug: input.slug,
        name: input.name,
        description: input.description || null,
        meta: toMeta(input),
        position: input.position,
        updatedAt: new Date(),
      },
    },
  );

  await recordAudit({
    actorId,
    action: "category.updated",
    target: `category:${id}`,
    // A slug change moves a live URL, so it is worth seeing in the log.
    metadata: { slug: input.slug, previousSlug: existing.slug },
  });

  return { ok: true, id };
}

export type DeleteResult = { ok: boolean; error?: string };

/**
 * Deleting a category is refused while it still holds products, so an archive
 * page never disappears by accident. (The embedded refs on products mean there
 * is no join to cascade; the product documents are never touched here.)
 */
export async function deleteCategory(
  id: string,
  actorId: string | null,
): Promise<DeleteResult> {
  const existing = await getCategory(id);
  if (!existing) return { ok: false, error: "Category not found." };

  const linked = await productsCollection().countDocuments({
    "content.categories.categoryId": id,
  });

  if (linked > 0) {
    return {
      ok: false,
      error: `${linked} ${linked === 1 ? "product is" : "products are"} still filed here. Move them first.`,
    };
  }

  await categoriesCollection().deleteOne({ _id: id });

  await recordAudit({
    actorId,
    action: "category.deleted",
    target: `category:${id}`,
    metadata: { slug: existing.slug },
  });

  return { ok: true };
}

/* ------------------------------ product links ----------------------------- */

export type ProductCategorySelection = {
  categoryId: string;
  isPrimary: boolean;
};

/** The categories a product is filed under, for the edit form. */
export async function getProductCategories(
  productId: string,
): Promise<ProductCategorySelection[]> {
  const doc = await productsCollection().findOne(
    { _id: productId },
    { projection: { "content.categories": 1 } },
  );
  return (doc?.content.categories ?? []).map((c) => ({
    categoryId: c.categoryId,
    isPrimary: c.isPrimary,
  }));
}

/**
 * Exactly one selection ends up primary: it drives the storefront's label and
 * breadcrumb, and a product with two would render differently depending on
 * order. Duplicates by categoryId are collapsed.
 */
export function normalizeSelections(
  selections: ProductCategorySelection[],
): ProductCategorySelection[] {
  const unique = [
    ...new Map(selections.map((s) => [s.categoryId, s])).values(),
  ];
  if (unique.length === 0) return unique;

  const primaryIndex = unique.findIndex((s) => s.isPrimary);
  return unique.map((selection, index) => ({
    ...selection,
    isPrimary: index === (primaryIndex === -1 ? 0 : primaryIndex),
  }));
}

/**
 * Resolve selections to the embedded refs a product stores: the slug and name
 * are denormalised from the category entity so the storefront needs no join.
 * A selection whose category no longer exists is dropped.
 */
export async function resolveCategoryRefs(
  selections: ProductCategorySelection[],
): Promise<ProductCategoryRef[]> {
  const normalized = normalizeSelections(selections);
  if (normalized.length === 0) return [];

  const docs = await categoriesCollection()
    .find(
      { _id: { $in: normalized.map((s) => s.categoryId) } },
      { projection: { slug: 1, name: 1 } },
    )
    .toArray();
  const byId = new Map(docs.map((d) => [d._id, d]));

  return normalized.flatMap((selection) => {
    const doc = byId.get(selection.categoryId);
    if (!doc) return [];
    return [
      {
        categoryId: selection.categoryId,
        slug: doc.slug,
        name: doc.name,
        isPrimary: selection.isPrimary,
      },
    ];
  });
}

/** The {slug, name, isPrimary} shape a content revision records. */
export function categorySnapshotFromRefs(
  refs: ProductCategoryRef[],
): { slug: string; name: string; isPrimary: boolean }[] {
  return refs.map((ref) => ({
    slug: ref.slug,
    name: ref.name,
    isPrimary: ref.isPrimary,
  }));
}
