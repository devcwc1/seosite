import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
    <html lang="en">
      <body>
        <header>
          <nav aria-label="Primary">
            {/* A nav is a list of destinations; the markup says so, which also
                keeps the links legible without any styling of our own. */}
            <ul>
              <li>
                <Link href="/">Orbit Storefront</Link>
              </li>
              <li>
                <Link href="/cart">Cart</Link>
              </li>
            </ul>
          </nav>
        </header>

        <main>{children}</main>

        <footer>
          <small>Reference storefront — powered by @orbit/next.</small>
        </footer>
      </body>
    </html>
  );
}
