import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategorySidebar } from "@/components/category-sidebar";
import { ProductCard } from "@/components/product-card";
import {
  allCategories,
  inCategory,
  isSortKey,
  orbit,
  SORTS,
  sortProducts,
  type SortKey,
} from "@/lib/orbit";

const PAGE_SIZE = 12;
const DEFAULT_SORT: SortKey = "name";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    page?: string;
    stock?: string;
    maxPrice?: string;
  }>;
};

async function loadCatalog() {
  try {
    return await orbit.listProducts();
  } catch {
    return null;
  }
}

/** Categories are editor-owned pages now, not names scraped off products. */
async function loadCategory(slug: string) {
  try {
    return await orbit.getCategory(slug);
  } catch {
    return null;
  }
}

/** Each category is a real page, so it gets prerendered and indexed. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const categories = await orbit.listCategories();
    return categories.map((category) => ({ slug: category.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);

  if (!category) return { title: "Category not found" };

  // An editor's meta wins; otherwise it is derived from what the page holds.
  return {
    title: category.meta.title || category.name,
    description:
      category.meta.description ||
      category.description ||
      `${category.productCount} ${
        category.productCount === 1 ? "product" : "products"
      } in ${category.name}.`,
    keywords: category.meta.keywords || undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const { sort, page, stock, maxPrice } = await searchParams;

  const products = await loadCatalog();
  if (!products) {
    return (
      <div className="shell py-section-gap">
        <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
          The catalog is temporarily unreachable. It comes back on its own —
          please try again in a moment.
        </p>
      </div>
    );
  }

  // The sidebar still counts what is actually on the shelf, but the page
  // itself belongs to the category record an editor maintains.
  const categories = allCategories(products);
  const category = await loadCategory(slug);
  if (!category) notFound();

  const activeSort: SortKey = isSortKey(sort) ? sort : DEFAULT_SORT;
  const stockOnly = stock === "in";
  const parsedMax = maxPrice ? Number(maxPrice) : NaN;
  const maxPriceFilter = Number.isFinite(parsedMax) ? parsedMax : null;

  const all = inCategory(products, slug);
  // The ceiling is the category's own top price, rounded up to a whole euro,
  // so the slider always spans exactly what is on offer here.
  const priceCeiling = Math.max(
    1,
    Math.ceil(Math.max(...all.map((product) => product.priceCents / 100))),
  );

  const filtered = all.filter(
    (product) =>
      (!stockOnly || product.inStock) &&
      (maxPriceFilter === null || product.priceCents / 100 <= maxPriceFilter),
  );

  const ordered = sortProducts(filtered, activeSort);
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(
    Math.max(1, Number(page) || 1),
    pageCount,
  );
  const visible = ordered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  /** Keep the active filters when changing sort or page. */
  function hrefWith(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    if (activeSort !== DEFAULT_SORT) query.set("sort", activeSort);
    if (stockOnly) query.set("stock", "in");
    if (maxPriceFilter !== null) query.set("maxPrice", String(maxPriceFilter));
    if (currentPage > 1) query.set("page", String(currentPage));

    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) query.delete(key);
      else query.set(key, value);
    }

    const suffix = query.toString();
    return `/categories/${slug}${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <main className="shell py-section-gap">
      <div className="mb-lg">
        <nav aria-label="Breadcrumb" className="mb-sm">
          <ol className="flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
            <li>
              <Link href="/" className="transition-colors hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link
                href="/categories"
                className="transition-colors hover:text-primary"
              >
                Categories
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="font-medium text-on-surface">{category.name}</li>
          </ol>
        </nav>

        <h1 className="text-headline-lg text-on-surface md:text-display-lg">
          {category.name}
        </h1>
        {/* The editor's intro copy is the page's own words; the count is a
            fact about the shelf and stays underneath it. */}
        {category.description ? (
          <p className="mt-sm max-w-3xl text-body-lg whitespace-pre-line text-on-surface-variant">
            {category.description}
          </p>
        ) : null}
        <p className="mt-xs text-body-sm text-on-surface-variant">
          {category.productCount}{" "}
          {category.productCount === 1 ? "product" : "products"} in this
          category.
        </p>
      </div>

      <div className="flex flex-col gap-gutter lg:flex-row">
        <CategorySidebar
          categories={categories}
          activeSlug={slug}
          stockOnly={stockOnly}
          maxPrice={maxPriceFilter}
          priceCeiling={priceCeiling}
        />

        <div className="flex-1">
          <div className="mb-md flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border-subtle bg-surface-muted p-sm">
            <span className="text-body-sm text-on-surface-variant">
              Showing {visible.length} of {ordered.length}
              {ordered.length !== all.length ? ` (${all.length} in total)` : ""}
            </span>

            <div className="flex flex-wrap items-center gap-xs text-body-sm">
              <span className="text-on-surface-variant">Sort by:</span>
              {/* Links, not a select: no JavaScript needed, and each ordering
                  is addressable. */}
              {(Object.keys(SORTS) as SortKey[]).map((key) => (
                <Link
                  key={key}
                  href={hrefWith({
                    sort: key === DEFAULT_SORT ? undefined : key,
                    page: undefined,
                  })}
                  aria-current={key === activeSort ? "true" : undefined}
                  className={`rounded-sm px-xs py-base transition-colors ${
                    key === activeSort
                      ? "bg-primary-container text-on-primary"
                      : "text-on-surface hover:text-primary"
                  }`}
                >
                  {SORTS[key]}
                </Link>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
              No products match these filters.{" "}
              <Link
                href={`/categories/${slug}`}
                className="text-primary hover:underline"
              >
                Reset them
              </Link>{" "}
              to see everything in {category.name}.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ul>
          )}

          {pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-lg flex justify-center">
              <ul className="flex items-center gap-xs">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                  (number) => (
                    <li key={number}>
                      <Link
                        href={hrefWith({
                          page: number === 1 ? undefined : String(number),
                        })}
                        aria-current={
                          number === currentPage ? "page" : undefined
                        }
                        className={`flex size-10 items-center justify-center rounded-DEFAULT transition-colors ${
                          number === currentPage
                            ? "bg-primary-container font-medium text-on-primary"
                            : "border border-outline-variant text-on-surface hover:border-primary hover:text-primary"
                        }`}
                      >
                        {number}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}
