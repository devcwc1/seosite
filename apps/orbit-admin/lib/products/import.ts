import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import {
  categoriesCollection,
  productsCollection,
} from "@/lib/db/mongo-collections";
import type { ProductCategorySelection } from "@/lib/categories/mutations";
import { slugify } from "./validation";

import { parseCsv } from "./csv";
import { fetchImageAsset } from "./import-images";
import {
  deduplicateSlugs,
  parseRow,
  type ColumnMapping,
  type ImportOptions,
  type ImportRow,
  type ParsedRow,
  type RowIssue,
} from "./import-map";
import {
  createProduct,
  getProductForEdit,
  updateProduct,
  type ProductEditData,
} from "./mutations";
import { productInputSchema } from "./validation";

/**
 * The database side of a product import: classify rows against what already
 * exists (preview), and carry out the create/update (run). The parsing and
 * coercion it builds on are pure and live in ./import-map.ts.
 */

/* ------------------------------- shared prep ----------------------------- */

type Existing = {
  /** SKU (lowercased) → the product it identifies. */
  bySku: Map<string, { id: string; slug: string }>;
  /** Every slug in use, so new products can be given a free one. */
  slugs: Set<string>;
  /** Category name (lowercased) → id, and slug → id, for create-or-link. */
  categoriesByName: Map<string, string>;
  categorySlugs: Set<string>;
};

async function loadExisting(): Promise<Existing> {
  const [productRows, categoryRows] = await Promise.all([
    productsCollection().find({}, { projection: { sku: 1, slug: 1 } }).toArray(),
    categoriesCollection().find({}, { projection: { name: 1, slug: 1 } }).toArray(),
  ]);

  const bySku = new Map<string, { id: string; slug: string }>();
  const slugs = new Set<string>();
  for (const row of productRows) {
    bySku.set(row.sku.toLowerCase(), { id: row._id, slug: row.slug });
    slugs.add(row.slug);
  }

  const categoriesByName = new Map<string, string>();
  const categorySlugs = new Set<string>();
  for (const row of categoryRows) {
    categoriesByName.set(row.name.toLowerCase(), row._id);
    categorySlugs.add(row.slug);
  }

  return { bySku, slugs, categoriesByName, categorySlugs };
}

/** Parse every data row, then make the valid rows' slugs unique as a set. */
function prepareRows(
  rows: string[][],
  mapping: ColumnMapping,
  options: ImportOptions,
  existingSlugs: Set<string>,
): { valid: ImportRow[]; invalid: Extract<ParsedRow, { ok: false }>[] } {
  const valid: ImportRow[] = [];
  const invalid: Extract<ParsedRow, { ok: false }>[] = [];

  rows.forEach((row, index) => {
    // +2: one for the header, one because humans count from 1.
    const parsed = parseRow(row, mapping, options, index + 2);
    if (parsed.ok) valid.push(parsed.row);
    else invalid.push(parsed);
  });

  // A create needs a free slug; an update keeps the product's own. So only
  // rows that will create should compete for slugs here — but which is which
  // depends on options.updateExisting, handled by seeding the used set with
  // existing slugs and letting updates re-take their own slug later.
  deduplicateSlugs(valid, existingSlugs);
  return { valid, invalid };
}

/* --------------------------------- preview ------------------------------- */

export type PreviewRow = {
  line: number;
  sku: string;
  title: string;
  action: "create" | "update" | "conflict" | "invalid";
  issues?: RowIssue[];
};

export type ImportPreview = {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  conflicts: number;
  invalid: number;
  /** Category names in the file that do not exist yet and would be created. */
  newCategories: string[];
  /** SKUs that appear more than once in the file. */
  duplicateSkus: string[];
  /** How many images would be fetched, across all rows. */
  imageCount: number;
  /** Per-row detail, capped for display. */
  rows: PreviewRow[];
};

const PREVIEW_ROW_CAP = 500;

export async function previewImport(
  fileText: string,
  mapping: ColumnMapping,
  options: ImportOptions,
): Promise<ImportPreview> {
  const { rows } = parseCsv(fileText);
  const existing = await loadExisting();
  const { valid, invalid } = prepareRows(rows, mapping, options, existing.slugs);

  const newCategories = new Set<string>();
  const seenSku = new Set<string>();
  const duplicateSkus = new Set<string>();
  let toCreate = 0;
  let toUpdate = 0;
  let conflicts = 0;
  let imageCount = 0;

  const previewRows: PreviewRow[] = [];

  for (const inv of invalid) {
    previewRows.push({
      line: inv.line,
      sku: inv.sku,
      title: inv.title,
      action: "invalid",
      issues: inv.issues,
    });
  }

  for (const row of valid) {
    const skuKey = row.sku.toLowerCase();
    if (seenSku.has(skuKey)) duplicateSkus.add(row.sku);
    seenSku.add(skuKey);

    imageCount += row.imageUrls.length;
    for (const name of row.categoryNames) {
      if (!existing.categoriesByName.has(name.toLowerCase())) newCategories.add(name);
    }

    let action: PreviewRow["action"];
    if (existing.bySku.has(skuKey)) {
      if (options.updateExisting) {
        action = "update";
        toUpdate++;
      } else {
        action = "conflict";
        conflicts++;
      }
    } else {
      action = "create";
      toCreate++;
    }
    previewRows.push({ line: row.line, sku: row.sku, title: row.title, action });
  }

  previewRows.sort((a, b) => a.line - b.line);

  return {
    totalRows: rows.length,
    toCreate,
    toUpdate,
    conflicts,
    invalid: invalid.length,
    newCategories: [...newCategories],
    duplicateSkus: [...duplicateSkus],
    imageCount,
    rows: previewRows.slice(0, PREVIEW_ROW_CAP),
  };
}

/* ----------------------------- category resolution ----------------------- */

/** Create-or-get by name, caching within a run and giving new ones a free slug. */
async function makeCategoryResolver(existing: Existing, actorId: string | null) {
  const byName = new Map(existing.categoriesByName);
  const usedSlugs = new Set(existing.categorySlugs);

  return async function resolve(name: string): Promise<string> {
    const key = name.toLowerCase();
    const found = byName.get(key);
    if (found) return found;

    let slug = slugify(name) || "category";
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(name) || "category"}-${n++}`;

    const now = new Date();
    const id = randomUUID();
    await categoriesCollection().insertOne({
      _id: id,
      slug,
      name,
      description: null,
      meta: {},
      position: 0,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    byName.set(key, id);
    usedSlugs.add(slug);
    await recordAudit({
      actorId,
      action: "category.created",
      target: `category:${id}`,
      metadata: { slug, name, via: "import" },
    });
    return id;
  };
}

/* ----------------------------------- run --------------------------------- */

export type ImportOutcome = {
  line: number;
  sku: string;
  title: string;
  action: "created" | "updated" | "skipped" | "failed";
  productId?: string;
  message?: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  categoriesCreated: number;
  imagesImported: number;
  imagesFailed: number;
  outcomes: ImportOutcome[];
};

/** Existing images/categories, so an update overwrites only what the file provides. */
function keepExisting(edit: ProductEditData) {
  return {
    images: edit.images.map((image) => ({ assetId: image.assetId, alt: image.alt })),
    categories: edit.categories as ProductCategorySelection[],
    meta: edit.meta,
  };
}

export async function runImport(
  fileText: string,
  mapping: ColumnMapping,
  options: ImportOptions,
  actorId: string | null,
): Promise<ImportResult> {
  const { rows } = parseCsv(fileText);
  const existing = await loadExisting();
  const { valid, invalid } = prepareRows(rows, mapping, options, existing.slugs);
  const resolveCategory = await makeCategoryResolver(existing, actorId);

  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    categoriesCreated: 0,
    imagesImported: 0,
    imagesFailed: 0,
    outcomes: [],
  };
  const categoriesBefore = existing.categoriesByName.size;

  for (const inv of invalid) {
    result.failed++;
    result.outcomes.push({
      line: inv.line,
      sku: inv.sku,
      title: inv.title,
      action: "failed",
      message: inv.issues.map((i) => i.message).join(" "),
    });
  }

  for (const row of valid) {
    const existingProduct = existing.bySku.get(row.sku.toLowerCase());
    if (existingProduct && !options.updateExisting) {
      result.skipped++;
      result.outcomes.push({
        line: row.line,
        sku: row.sku,
        title: row.title,
        action: "skipped",
        message: "A product with this SKU already exists.",
      });
      continue;
    }

    try {
      // Categories the row names, resolved (and created) to selections.
      const categorySelections: ProductCategorySelection[] = [];
      for (const name of row.categoryNames) {
        const id = await resolveCategory(name);
        // First category is primary; a product needs exactly one.
        if (!categorySelections.some((c) => c.categoryId === id)) {
          categorySelections.push({ categoryId: id, isPrimary: categorySelections.length === 0 });
        }
      }

      // Images the row names, each fetched independently; a failure skips that
      // one image and is reported, rather than failing the whole product.
      const imageSelections: { assetId: string; alt: string }[] = [];
      for (const url of row.imageUrls) {
        const fetched = await fetchImageAsset(url, actorId);
        if (fetched.ok) {
          if (!imageSelections.some((img) => img.assetId === fetched.assetId)) {
            imageSelections.push({ assetId: fetched.assetId, alt: row.title });
          }
          result.imagesImported++;
        } else {
          result.imagesFailed++;
        }
      }

      // On update, preserve what the file does not carry.
      let images = imageSelections;
      let cats = categorySelections;
      let meta = { title: row.metaTitle, description: row.metaDescription, keywords: row.metaKeywords };

      if (existingProduct) {
        const current = await getProductForEdit(existingProduct.id);
        if (current) {
          const kept = keepExisting(current);
          if (!options.importImages || row.imageUrls.length === 0) images = kept.images;
          if (row.categoryNames.length === 0) cats = kept.categories;
          meta = {
            title: row.metaTitle || (kept.meta.title ?? ""),
            description: row.metaDescription || (kept.meta.description ?? ""),
            keywords: row.metaKeywords || (kept.meta.keywords ?? ""),
          };
        }
      }

      const input = productInputSchema.parse({
        title: row.title,
        // On update, keep the product's own slug rather than moving its URL.
        slug: existingProduct ? existingProduct.slug : row.slug,
        sku: row.sku,
        status: row.status,
        shortInfo: row.shortInfo,
        description: row.description,
        price: row.price,
        currency: row.currency,
        inStock: row.inStock,
        stockQuantity: row.stockQuantity,
        images,
        categories: cats,
        meta,
        reviews: [],
      });

      const outcome = existingProduct
        ? await updateProduct(existingProduct.id, input, actorId)
        : await createProduct(input, actorId);

      if (outcome.ok) {
        if (existingProduct) result.updated++;
        else result.created++;
        result.outcomes.push({
          line: row.line,
          sku: row.sku,
          title: row.title,
          action: existingProduct ? "updated" : "created",
          productId: outcome.id,
        });
      } else {
        result.failed++;
        result.outcomes.push({
          line: row.line,
          sku: row.sku,
          title: row.title,
          action: "failed",
          message: Object.values(outcome.errors).join(" "),
        });
      }
    } catch (error) {
      result.failed++;
      result.outcomes.push({
        line: row.line,
        sku: row.sku,
        title: row.title,
        action: "failed",
        message: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  // Report how many categories the run created, by re-counting.
  const categoriesNow = await categoriesCollection().countDocuments({});
  result.categoriesCreated = Math.max(0, categoriesNow - categoriesBefore);

  await recordAudit({
    actorId,
    action: "products.imported",
    target: "products:import",
    metadata: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
    },
  });

  return result;
}
