import "server-only";
import { toStoredMeta } from "@/lib/seo/meta";

import { asc, count, eq, inArray } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  categories,
  productCategories,
  type Category,
  type ProductMeta,
} from "@/lib/db/schema";

import type { CategoryParsed } from "./validation";

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

export type CategoryWithCount = Category & { productCount: number };

function toMeta(input: CategoryParsed): ProductMeta {
  return toStoredMeta(input.meta);
}

/** Ordered as the storefront nav shows them: position, then name. */
export async function listCategories(): Promise<CategoryWithCount[]> {
  const rows = await db
    .select({
      category: categories,
      productCount: count(productCategories.id),
    })
    .from(categories)
    .leftJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id),
    )
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name));

  return rows.map((row) => ({ ...row.category, productCount: row.productCount }));
}

export async function getCategory(id: string): Promise<Category | null> {
  const [row] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return row ?? null;
}

async function slugTaken(slug: string, excludeId: string | null) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return row !== undefined && row.id !== excludeId;
}

export async function createCategory(
  input: CategoryParsed,
  actorId: string | null,
): Promise<MutationResult> {
  if (await slugTaken(input.slug, null)) {
    return { ok: false, errors: { slug: "This slug is already in use." } };
  }

  const [row] = await db
    .insert(categories)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description || null,
      meta: toMeta(input),
      position: input.position,
      createdBy: actorId,
    })
    .returning({ id: categories.id });
  if (!row) return { ok: false, errors: { form: "Could not create category." } };

  await recordAudit({
    actorId,
    action: "category.created",
    target: `category:${row.id}`,
    metadata: { slug: input.slug, name: input.name },
  });

  return { ok: true, id: row.id };
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

  await db
    .update(categories)
    .set({
      slug: input.slug,
      name: input.name,
      description: input.description || null,
      meta: toMeta(input),
      position: input.position,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id));

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
 * Deleting a category unfiles every product in it (the link cascades) but
 * never touches the products themselves. Refused while it still holds
 * products, so an archive page never disappears by accident.
 */
export async function deleteCategory(
  id: string,
  actorId: string | null,
): Promise<DeleteResult> {
  const existing = await getCategory(id);
  if (!existing) return { ok: false, error: "Category not found." };

  const [{ value: linked } = { value: 0 }] = await db
    .select({ value: count() })
    .from(productCategories)
    .where(eq(productCategories.categoryId, id));

  if (linked > 0) {
    return {
      ok: false,
      error: `${linked} ${linked === 1 ? "product is" : "products are"} still filed here. Move them first.`,
    };
  }

  await db.delete(categories).where(eq(categories.id, id));

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
  const rows = await db
    .select({
      categoryId: productCategories.categoryId,
      isPrimary: productCategories.isPrimary,
    })
    .from(productCategories)
    .where(eq(productCategories.productId, productId));

  return rows;
}

/**
 * Replace a product's category links inside the caller's transaction, so the
 * change lands with the rest of the product write or not at all.
 *
 * Exactly one link ends up primary: it drives the storefront's label and
 * breadcrumb, and a product with two would render differently depending on
 * row order.
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

export async function setProductCategories(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  selections: ProductCategorySelection[],
): Promise<void> {
  await tx
    .delete(productCategories)
    .where(eq(productCategories.productId, productId));

  const normalized = normalizeSelections(selections);
  if (normalized.length === 0) return;

  await tx.insert(productCategories).values(
    normalized.map((selection) => ({
      productId,
      categoryId: selection.categoryId,
      isPrimary: selection.isPrimary,
    })),
  );
}

/**
 * Resolve selections to the {slug, name, isPrimary} shape a content revision
 * records. A revision is history: it keeps the names as they were, even if a
 * category is later renamed or deleted.
 */
export async function resolveCategorySnapshot(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  selections: ProductCategorySelection[],
): Promise<{ slug: string; name: string; isPrimary: boolean }[]> {
  const normalized = normalizeSelections(selections);
  if (normalized.length === 0) return [];

  const rows = await tx
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(
      inArray(
        categories.id,
        normalized.map((s) => s.categoryId),
      ),
    );

  const byId = new Map(rows.map((row) => [row.id, row]));

  return normalized.flatMap((selection) => {
    const row = byId.get(selection.categoryId);
    if (!row) return [];
    return [{ slug: row.slug, name: row.name, isPrimary: selection.isPrimary }];
  });
}

/** Category rows as the storefront DTO wants them, for one product. */
export async function categoriesForProducts(
  productIds: string[],
): Promise<Map<string, { slug: string; name: string; isPrimary: boolean }[]>> {
  const grouped = new Map<
    string,
    { slug: string; name: string; isPrimary: boolean }[]
  >();
  if (productIds.length === 0) return grouped;

  const rows = await db
    .select({
      productId: productCategories.productId,
      slug: categories.slug,
      name: categories.name,
      isPrimary: productCategories.isPrimary,
      position: categories.position,
    })
    .from(productCategories)
    .innerJoin(categories, eq(categories.id, productCategories.categoryId))
    .where(inArray(productCategories.productId, productIds))
    .orderBy(asc(categories.position), asc(categories.name));

  for (const row of rows) {
    const list = grouped.get(row.productId) ?? [];
    list.push({ slug: row.slug, name: row.name, isPrimary: row.isPrimary });
    grouped.set(row.productId, list);
  }

  return grouped;
}
