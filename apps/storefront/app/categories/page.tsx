import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";
import { allCategories, orbit } from "@/lib/orbit";

export const metadata = {
  title: "Categories",
  description: "Every category in the Orbit catalog, with what each holds.",
};

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof allCategories>> = [];
  let reachable = true;

  try {
    categories = allCategories(await orbit.listProducts());
  } catch {
    reachable = false;
  }

  return (
    <main className="shell py-section-gap">
      <nav aria-label="Breadcrumb" className="mb-sm">
        <ol className="flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="font-medium text-on-surface">Categories</li>
        </ol>
      </nav>

      <h1 className="text-headline-lg text-on-surface md:text-display-lg">
        Categories
      </h1>
      <p className="mt-sm mb-lg max-w-3xl text-body-lg text-on-surface-variant">
        {reachable
          ? "Categories come from the products themselves — an empty one never appears here."
          : "The catalog is temporarily unreachable, so categories cannot be listed."}
      </p>

      {categories.length === 0 ? (
        <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
          {reachable
            ? "No published product carries a category yet."
            : "Please try again in a moment."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/categories/${category.slug}`}
                className="hover-lift group flex h-full items-center justify-between gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-card"
              >
                <span>
                  <span className="block text-headline-md text-on-surface">
                    {category.name}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {category.count}{" "}
                    {category.count === 1 ? "product" : "products"}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition group-hover:brightness-110"
                >
                  <ArrowRightIcon className="size-5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
