import { slugify } from "./validation";

/**
 * Turning arbitrary export columns into Orbit product fields.
 *
 * This half is pure — no database, no network — so the mapping, coercion and
 * validation rules can be tested directly and a preview can be built without
 * writing anything. The database and image work live in ./import.ts.
 *
 * The admin maps each field to a column by hand; nothing is inferred from
 * header names. A header is only a label — an export that mislabels or shifts
 * its columns would otherwise load, say, prices into the stock field — so the
 * mapping is by position, shown against a real sample value before it runs.
 */

/** Orbit product fields an import can populate. */
export const IMPORT_FIELDS = [
  "title",
  "sku",
  "slug",
  "shortInfo",
  "description",
  "price",
  "currency",
  "stockQuantity",
  "inStock",
  "status",
  "categories",
  "images",
  "metaTitle",
  "metaDescription",
  "metaKeywords",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Only these two identify a product; the rest have defaults. */
export const REQUIRED_FIELDS: ImportField[] = ["title", "sku"];

/** Orbit field → source column index, or null when the field is unmapped. */
export type ColumnMapping = Partial<Record<ImportField, number | null>>;

export type ImportOptions = {
  /** Applied when no currency column is mapped. */
  defaultCurrency: string;
  /** Applied when no status column is mapped, or a value is unrecognised. */
  defaultStatus: "draft" | "published" | "archived";
  /**
   * Update a product when its SKU already exists, rather than reporting a
   * conflict. Off means the import only creates.
   */
  updateExisting: boolean;
  /**
   * Bring in images from the URLs in the mapped column. Off skips them, which
   * is much faster for a first dry run.
   */
  importImages: boolean;
};

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  defaultCurrency: "EUR",
  defaultStatus: "draft",
  updateExisting: true,
  importImages: false,
};

/** One product's worth of import values, already coerced. */
export type ImportRow = {
  /** 1-based line number in the file, for error messages. */
  line: number;
  title: string;
  sku: string;
  slug: string;
  shortInfo: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  inStock: boolean;
  status: "draft" | "published" | "archived";
  /** Category names, leaf only; resolved to ids at run time. */
  categoryNames: string[];
  /** http(s) image URLs; fetched at run time. */
  imageUrls: string[];
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

export type RowIssue = { field: ImportField | "row"; message: string };

export type ParsedRow =
  | { ok: true; row: ImportRow }
  | { ok: false; line: number; sku: string; title: string; issues: RowIssue[] };

/* ------------------------------- coercion -------------------------------- */

function cell(row: string[], index: number | null | undefined): string {
  if (index === null || index === undefined) return "";
  return (row[index] ?? "").trim();
}

/**
 * A money string to a number. Handles a currency symbol, thousands separators
 * and a comma decimal ("1.234,50" and "1,234.50" both mean 1234.5). Returns
 * null for anything that is not a number, so it can be reported rather than
 * silently become zero.
 */
export function parseDecimal(input: string): number | null {
  let s = input.replace(/[^\d.,-]/g, "").trim();
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Comma is the decimal separator; dots are thousands.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Dot is the decimal separator (or there is none); commas are thousands.
    s = s.replace(/,/g, "");
  }

  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

const TRUE_WORDS = new Set(["1", "true", "yes", "y", "instock", "in stock", "on"]);
const FALSE_WORDS = new Set(["0", "false", "no", "n", "outofstock", "out of stock", "off"]);

/** A loose boolean. Returns null for a value that is neither, so a bad column choice shows. */
export function parseBoolean(input: string): boolean | null {
  const s = input.trim().toLowerCase();
  if (s === "") return null;
  if (TRUE_WORDS.has(s)) return true;
  if (FALSE_WORDS.has(s)) return false;
  return null;
}

function parseStatus(
  input: string,
  fallback: ImportOptions["defaultStatus"],
): ImportOptions["defaultStatus"] {
  const s = input.trim().toLowerCase();
  if (s === "") return fallback;
  if (["publish", "published", "1", "true", "yes", "active"].includes(s)) return "published";
  if (["draft", "0", "false", "no", "pending"].includes(s)) return "draft";
  if (["archived", "archive", "trash"].includes(s)) return "archived";
  return fallback;
}

/**
 * A category cell to leaf names. WooCommerce separates categories with commas
 * and expresses hierarchy with ">"; Orbit's categories are flat, so only the
 * leaf ("Clothing > Shirts" → "Shirts") is kept.
 */
export function parseCategories(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const segments = part.split(">").map((x) => x.trim()).filter(Boolean);
      return segments[segments.length - 1] ?? "";
    })
    .filter(Boolean);
}

/** An image cell to http(s) URLs. Anything else is dropped rather than fetched. */
export function parseImageUrls(input: string): string[] {
  return input
    .split(/[,\n|]/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part));
}

/* ------------------------------- the rows -------------------------------- */

const MAX_SHORT = 512;
const MAX_DESCRIPTION = 20000;
const MAX_META_TITLE = 255;
const MAX_META_DESCRIPTION = 1000;
const MAX_META_KEYWORDS = 500;

/**
 * One source row to a validated ImportRow, or the reasons it cannot be one.
 * Slug is derived here but de-duplicated across the batch by the caller, since
 * uniqueness is a property of the set, not the row.
 */
export function parseRow(
  row: string[],
  mapping: ColumnMapping,
  options: ImportOptions,
  line: number,
): ParsedRow {
  const issues: RowIssue[] = [];

  const title = cell(row, mapping.title);
  const sku = cell(row, mapping.sku);
  if (title === "") issues.push({ field: "title", message: "Name is required." });
  if (title.length > 255) issues.push({ field: "title", message: "Name is too long (max 255)." });
  if (sku === "") issues.push({ field: "sku", message: "SKU is required." });
  if (sku.length > 64) issues.push({ field: "sku", message: "SKU is too long (max 64)." });

  const priceCell = cell(row, mapping.price);
  let price = 0;
  if (mapping.price !== null && mapping.price !== undefined && priceCell !== "") {
    const parsed = parseDecimal(priceCell);
    if (parsed === null) issues.push({ field: "price", message: `Not a number: "${priceCell}".` });
    else if (parsed < 0) issues.push({ field: "price", message: "Price cannot be negative." });
    else price = parsed;
  }

  const stockCell = cell(row, mapping.stockQuantity);
  let stockQuantity = 0;
  if (mapping.stockQuantity !== null && mapping.stockQuantity !== undefined && stockCell !== "") {
    const parsed = parseDecimal(stockCell);
    if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) {
      issues.push({ field: "stockQuantity", message: `Not a whole number: "${stockCell}".` });
    } else {
      stockQuantity = parsed;
    }
  }

  // In stock: the mapped column wins; otherwise inferred from the quantity.
  const inStockCell = cell(row, mapping.inStock);
  let inStock = stockQuantity > 0;
  if (mapping.inStock !== null && mapping.inStock !== undefined && inStockCell !== "") {
    const parsed = parseBoolean(inStockCell);
    if (parsed === null) {
      issues.push({ field: "inStock", message: `Not yes/no: "${inStockCell}".` });
    } else {
      inStock = parsed;
    }
  }

  const currencyRaw = cell(row, mapping.currency) || options.defaultCurrency;
  const currency = currencyRaw.trim().toUpperCase();
  if (currency.length !== 3) {
    issues.push({ field: "currency", message: `Currency must be a 3-letter code, got "${currencyRaw}".` });
  }

  let slug = slugify(cell(row, mapping.slug) || title);
  if (slug === "") slug = slugify(sku);

  const clamp = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

  if (issues.length > 0) {
    return { ok: false, line, sku, title, issues };
  }

  return {
    ok: true,
    row: {
      line,
      title,
      sku,
      slug,
      shortInfo: clamp(cell(row, mapping.shortInfo), MAX_SHORT),
      description: clamp(cell(row, mapping.description), MAX_DESCRIPTION),
      price,
      currency,
      stockQuantity,
      // A product out of stock has no available quantity, matching the storefront rule.
      inStock,
      status: parseStatus(cell(row, mapping.status), options.defaultStatus),
      categoryNames: parseCategories(cell(row, mapping.categories)),
      imageUrls: options.importImages ? parseImageUrls(cell(row, mapping.images)) : [],
      metaTitle: clamp(cell(row, mapping.metaTitle), MAX_META_TITLE),
      metaDescription: clamp(cell(row, mapping.metaDescription), MAX_META_DESCRIPTION),
      metaKeywords: clamp(cell(row, mapping.metaKeywords), MAX_META_KEYWORDS),
    },
  };
}

/**
 * Make slugs unique across a batch, and against slugs already in use.
 * Mutates the rows in place; a clash gets `-2`, `-3`, and so on. Rows are
 * processed in file order, so the first occurrence keeps the clean slug.
 */
export function deduplicateSlugs(rows: ImportRow[], existing: Set<string>): void {
  const used = new Set(existing);
  for (const row of rows) {
    let candidate = row.slug;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${row.slug}-${n}`;
      n++;
    }
    row.slug = candidate;
    used.add(candidate);
  }
}
