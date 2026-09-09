import Link from "next/link";

import type { CategorySummary } from "@/lib/orbit";

/**
 * The design's filter rail. Categories are links rather than checkboxes —
 * each one is a real page with its own URL, which is both simpler and better
 * for a site that wants to be indexed. Price and availability post back as a
 * GET form, so the rail works with JavaScript switched off.
 */
export function CategorySidebar({
  categories,
  activeSlug,
  stockOnly,
  maxPrice,
  priceCeiling,
}: {
  categories: CategorySummary[];
  activeSlug: string;
  stockOnly: boolean;
  maxPrice: number | null;
  priceCeiling: number;
}) {
  return (
    <aside className="h-fit w-full rounded-xl border border-border-subtle bg-surface-muted p-md lg:sticky lg:top-[8rem] lg:w-64 lg:shrink-0">
      <h2 className="mb-md border-b border-outline-variant pb-xs text-headline-sm">
        Filters
      </h2>

      <div className="mb-md">
        <h3 className="mb-sm text-label-md tracking-wider text-on-surface-variant uppercase">
          Categories
        </h3>
        <ul className="flex flex-col gap-xs text-body-sm">
          {categories.map((category) => {
            const active = category.slug === activeSlug;

            return (
              <li key={category.slug}>
                <Link
                  href={`/categories/${category.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-xs transition-colors ${
                    active
                      ? "font-semibold text-primary"
                      : "text-on-surface hover:text-primary"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-4 shrink-0 rounded-full border ${
                      active
                        ? "border-[5px] border-primary"
                        : "border-outline-variant"
                    }`}
                  />
                  {category.name} ({category.count})
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* One form, so price and availability apply together. */}
      <form className="flex flex-col gap-md">
        <div>
          <h3 className="mb-sm text-label-md tracking-wider text-on-surface-variant uppercase">
            Price
          </h3>
          <label
            htmlFor="maxPrice"
            className="mb-xs block text-body-sm text-on-surface-variant"
          >
            Up to €{maxPrice ?? priceCeiling}
          </label>
          <input
            id="maxPrice"
            type="range"
            name="maxPrice"
            min={0}
            max={priceCeiling}
            step={1}
            defaultValue={maxPrice ?? priceCeiling}
            className="w-full accent-primary"
          />
          <div className="mt-xs flex items-center justify-between text-body-sm text-on-surface-variant">
            <span className="rounded-sm border border-outline-variant bg-surface-container px-xs py-base">
              €0
            </span>
            <span aria-hidden>–</span>
            <span className="rounded-sm border border-outline-variant bg-surface-container px-xs py-base">
              €{priceCeiling}
            </span>
          </div>
        </div>

        <div>
          <h3 className="mb-sm text-label-md tracking-wider text-on-surface-variant uppercase">
            Availability
          </h3>
          <label className="flex cursor-pointer items-center gap-xs text-body-sm">
            <input
              type="checkbox"
              name="stock"
              value="in"
              defaultChecked={stockOnly}
              className="size-4 rounded-sm border-outline-variant accent-primary"
            />
            In stock only
          </label>
        </div>

        <div className="flex items-center gap-sm">
          <button
            type="submit"
            className="rounded-DEFAULT bg-primary px-md py-xs text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            Apply
          </button>
          {stockOnly || maxPrice !== null ? (
            <Link
              href={`/categories/${activeSlug}`}
              className="text-body-sm text-primary underline-offset-2 hover:underline"
            >
              Reset
            </Link>
          ) : null}
        </div>
      </form>
    </aside>
  );
}
