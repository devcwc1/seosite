import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import { CartIcon, PharmacyMark } from "@/components/icons";

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
 * Application shell.
 *
 * `@orbit/next` is a data-access SDK: it exposes no React context and no
 * provider component, so there is nothing to mount here. Routes create their
 * data dependency where they need it (see `lib/orbit.ts`).
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-background text-body-md text-on-surface">
        <header className="sticky top-0 z-50 bg-surface shadow-card">
          <div className="shell flex items-center justify-between gap-md py-sm">
            <Link
              href="/"
              className="flex items-center gap-xs text-body-lg font-bold whitespace-nowrap text-primary sm:text-headline-md"
            >
              <PharmacyMark className="size-6 shrink-0 sm:size-7" />
              Orbit Storefront
            </Link>

            {/* A nav is a list of destinations; the markup says so. Only routes
                that exist are listed — no placeholder categories. */}
            <nav aria-label="Primary">
              <ul className="flex items-center gap-sm sm:gap-md">
                <li>
                  <Link
                    href="/products"
                    className="text-body-md text-on-surface-variant transition-colors hover:text-primary"
                  >
                    Catalog
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cart"
                    aria-label="Cart"
                    className="flex items-center gap-xs rounded-DEFAULT border border-primary px-xs py-xs text-body-md font-semibold text-primary transition-colors hover:bg-primary-fixed sm:px-sm"
                  >
                    <CartIcon className="size-5 shrink-0" />
                    <span className="hidden sm:inline">Cart</span>
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-xl border-t border-surface-container-highest bg-surface-container-low">
          <div className="shell flex flex-wrap items-center justify-between gap-sm py-lg">
            <p className="flex items-center gap-xs text-body-sm font-semibold text-on-surface">
              <PharmacyMark className="size-5 text-primary" />
              Orbit Storefront
            </p>
            <p className="text-body-sm text-on-surface-variant">
              Reference storefront — content served through @orbit/next.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
