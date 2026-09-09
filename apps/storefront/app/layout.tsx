import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import {
  ArrowUpIcon,
  CartIcon,
  PharmacyMark,
  SearchIcon,
} from "@/components/icons";
import { allCategories, orbit } from "@/lib/orbit";

import "./globals.css";

/**
 * Inter carries the whole design: it was chosen for legibility at small sizes,
 * so the type scale in `globals.css` assumes it rather than a fallback.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Orbit Storefront",
    template: "%s · Orbit Storefront",
  },
  description:
    "Reference storefront consuming Orbit content through the @orbit/next SDK.",
};

/**
 * Search posts straight to the catalog as a GET — no client component, no
 * JavaScript, and the query stays in the URL where it can be shared.
 */
function SearchField({ className = "" }: { className?: string }) {
  return (
    <form action="/products" className={`relative ${className}`.trim()}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-sm size-5 -translate-y-1/2 text-on-surface-variant" />
      <input
        type="search"
        name="q"
        placeholder="Search products…"
        aria-label="Search products"
        className="w-full rounded-DEFAULT border border-border-subtle bg-surface-container-lowest py-xs pr-sm pl-lg text-body-sm transition-colors focus:border-primary-container focus:outline-none"
      />
    </form>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The nav is built from the catalog's own categories, so it can never offer
  // a section that holds nothing. A dead content API just means no nav row.
  let categories: { slug: string; name: string }[] = [];
  try {
    categories = allCategories(await orbit.listProducts());
  } catch {
    categories = [];
  }

  return (
    <html lang="en" className={inter.variable}>
      <body
        id="top"
        className="flex min-h-screen flex-col bg-background text-body-md text-on-surface"
      >
        <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface">
          <div className="shell flex flex-col gap-sm py-sm">
            <div className="flex items-center justify-between gap-md">
              <Link
                href="/"
                className="flex items-center gap-xs text-body-lg font-bold whitespace-nowrap text-primary sm:text-headline-md"
              >
                <PharmacyMark className="size-6 shrink-0 sm:size-7" />
                Orbit Storefront
              </Link>

              <SearchField className="mx-md hidden max-w-[28rem] flex-1 md:block" />

              <nav aria-label="Primary" className="flex items-center gap-sm">
                <Link
                  href="/products"
                  className="hidden text-body-md text-on-surface-variant transition-colors hover:text-primary sm:block"
                >
                  Catalog
                </Link>
                <Link
                  href="/cart"
                  aria-label="Cart, empty"
                  className="relative rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                >
                  <CartIcon className="size-6" />
                  {/* The cart is always empty until an order contract exists,
                      so the count is honest rather than decorative. */}
                  <span className="absolute top-0 right-0 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                    0
                  </span>
                </Link>
              </nav>
            </div>

            {categories.length > 0 ? (
              <nav aria-label="Categories" className="hidden md:block">
                <ul className="flex gap-md overflow-x-auto">
                  <li>
                    <Link
                      href="/products"
                      className="pb-1 text-label-md whitespace-nowrap text-on-surface-variant transition-colors hover:text-primary"
                    >
                      All products
                    </Link>
                  </li>
                  {categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={`/categories/${category.slug}`}
                        className="pb-1 text-label-md whitespace-nowrap text-on-surface-variant uppercase transition-colors hover:text-primary"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        </header>

        {/* The design keeps search reachable on small screens by moving it
            below the bar rather than hiding it behind a toggle. */}
        <div className="border-b border-outline-variant bg-surface px-gutter py-xs md:hidden">
          <SearchField />
        </div>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-outline-variant bg-surface-container-low">
          <div className="shell grid grid-cols-1 gap-lg py-section-gap md:grid-cols-4">
            <div className="flex flex-col gap-sm">
              <p className="flex items-center gap-xs text-headline-sm text-primary">
                <PharmacyMark className="size-6" />
                Orbit Storefront
              </p>
              <p className="text-body-sm text-on-surface-variant">
                A reference storefront for the Orbit platform. Every product,
                price and image here is published from the Orbit admin and read
                through the <code>@orbit/next</code> SDK.
              </p>
            </div>

            <div>
              <h2 className="mb-sm text-label-md font-bold text-primary uppercase">
                Store
              </h2>
              <ul className="flex flex-col gap-xs">
                {[
                  { href: "/", label: "Home" },
                  { href: "/products", label: "Catalog" },
                  { href: "/categories", label: "Categories" },
                  { href: "/cart", label: "Cart" },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block text-body-sm text-on-surface-variant transition-all duration-200 hover:translate-x-1 hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="mb-sm text-label-md font-bold text-primary uppercase">
                Categories
              </h2>
              {categories.length > 0 ? (
                <ul className="flex flex-col gap-xs">
                  {categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={`/categories/${category.slug}`}
                        className="block text-body-sm text-on-surface-variant transition-all duration-200 hover:translate-x-1 hover:text-primary"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-on-surface-variant">
                  None published yet.
                </p>
              )}
            </div>

            <div>
              <h2 className="mb-sm text-label-md font-bold text-primary uppercase">
                Not built yet
              </h2>
              {/* Plain text, not links: naming what is missing is useful;
                  linking to pages that do not exist is not. */}
              <ul className="flex flex-col gap-xs text-body-sm text-on-surface-variant">
                <li>Accounts and sign-in</li>
                <li>Cart that survives a reload</li>
                <li>Checkout and payment</li>
                <li>Order history</li>
              </ul>
            </div>
          </div>

          <div className="shell flex flex-col items-center justify-between gap-sm border-t border-border-subtle py-sm text-center md:flex-row">
            <span className="text-body-sm text-on-surface-variant">
              © {new Date().getFullYear()} Orbit. Reference implementation.
            </span>
            <span className="text-body-sm text-on-surface-variant">
              Content served through @orbit/next
            </span>
          </div>
        </footer>

        {/* The design floats a WhatsApp button here; with no support channel to
            point at, the slot carries the one action that always works. */}
        <a
          href="#top"
          aria-label="Back to top"
          className="fixed right-md bottom-md z-50 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lift transition-transform hover:scale-110"
        >
          <ArrowUpIcon className="size-6" />
        </a>
      </body>
    </html>
  );
}
