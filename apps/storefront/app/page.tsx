import type { Metadata } from "next";
import Link from "next/link";
import type { StorefrontProduct } from "@orbit/next";
import { siteJsonLd } from "@orbit/next/seo";

import { JsonLd } from "@/components/json-ld";
import {
  ArrowRightIcon,
  CheckIcon,
  DocumentIcon,
  ImagePlaceholderIcon,
  PlugIcon,
  ShieldIcon,
} from "@/components/icons";
import { StockBadge } from "@/components/stock-badge";
import { formatPrice, orbit, primaryImage } from "@/lib/orbit";
import { getSite, pageMetadata, siteOrigin } from "@/lib/seo";

/**
 * Home, following the Apotheek 24/7 "Home" screen: hero band with a stat card,
 * an assurance strip, a four-up featured grid on the 12-column bento, and a
 * two-column explainer. The design's own copy sells a Dutch pharmacy, so the
 * words here describe this store instead — the layout and type scale are the
 * part that carries over.
 */

const FEATURED_COUNT = 4;

/** The three facts this storefront can actually stand behind. */
const ASSURANCES = [
  "Read-only SDK",
  "Refreshed every 60 seconds",
  "Images re-encoded to WebP",
];

const STEPS = [
  {
    icon: DocumentIcon,
    title: "Published in Orbit",
    body: "An editor creates the product, its gallery and its copy in the admin. Nothing on this page is hand-written.",
  },
  {
    icon: PlugIcon,
    title: "Read through one contract",
    body: "@orbit/next owns the base URL, the DTO shapes and the caching policy. The storefront holds no database credentials of its own.",
  },
  {
    icon: ShieldIcon,
    title: "Images from a hardened intake",
    body: "Uploads are sniffed, size- and dimension-checked, re-encoded through sharp and stored content-addressed before they are ever served.",
  },
];

function FeaturedCard({ product }: { product: StorefrontProduct }) {
  const image = primaryImage(product);

  return (
    <li className="col-span-12 md:col-span-6 lg:col-span-3">
      <Link
        href={`/products/${product.slug}`}
        className="glass-card group flex h-full flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-lift"
      >
        <div className="relative flex flex-1 items-center justify-center bg-surface-muted p-sm">
          <StockBadge
            inStock={product.inStock}
            className="absolute top-xs left-xs z-10"
          />
          {image ? (
            /* Remote URLs from the content API bypass next/image's allow-list. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt ?? product.title}
              className="h-40 object-contain transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholderIcon className="size-10 text-outline" />
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between border-t border-border-subtle bg-surface p-sm">
          <div>
            <h3 className="mb-xs line-clamp-2 text-headline-sm text-on-surface">
              {product.title}
            </h3>
            <p className="mb-sm text-price-display text-primary-container">
              {formatPrice(product)}
            </p>
          </div>

          <span className="flex w-full items-center justify-center gap-xs rounded-DEFAULT border border-primary-container bg-surface-container-lowest py-xs text-label-md text-primary-container transition-colors group-hover:bg-primary-container group-hover:text-on-primary">
            View product
            <ArrowRightIcon className="size-4" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return pageMetadata(site, { path: "/" });
}

export default async function HomePage() {
  const site = await getSite();

  let products: StorefrontProduct[] = [];
  let reachable = true;

  try {
    products = await orbit.listProducts();
  } catch {
    // Degrade rather than fail: the hero and explainer still stand on their own.
    reachable = false;
  }

  const featured = products.slice(0, FEATURED_COUNT);

  return (
    <>
      <JsonLd data={siteJsonLd(site, siteOrigin(site))} />
      {/* -- hero ---------------------------------------------------------- */}
      <section className="hero-band relative overflow-hidden py-section-gap text-on-primary">
        <div className="shell flex flex-col items-start justify-between gap-lg md:flex-row md:items-center">
          <div className="max-w-[36rem]">
            <h1 className="mb-sm text-headline-lg text-balance sm:text-display-lg">
              The catalog, exactly as published.
            </h1>
            <p className="mb-lg text-body-lg opacity-90">
              Every product, price and image on this site is read live from the
              Orbit admin. Nothing is duplicated, and nothing goes stale for
              longer than a minute.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-xs rounded-DEFAULT bg-surface-container-lowest px-lg py-sm text-label-md text-primary-container shadow-card transition-colors hover:bg-surface-muted"
            >
              Browse the catalog
              <ArrowRightIcon className="size-5" />
            </Link>
          </div>

          {/* The design puts a promotional card here; ours carries a real
              number instead of an offer we would have to invent. */}
          <div className="rounded-xl border border-on-primary/20 bg-on-primary/10 p-lg text-center backdrop-blur-md">
            <p className="text-display-lg tabular-nums">
              {reachable ? products.length : "—"}
            </p>
            <p className="mt-xs text-headline-lg tracking-widest uppercase">
              {products.length === 1 ? "Product" : "Products"}
            </p>
            <p className="mt-xs text-body-sm opacity-80">published right now</p>
          </div>
        </div>
      </section>

      {/* -- assurance strip ----------------------------------------------- */}
      <section className="border-b border-outline-variant bg-surface-container-low py-lg">
        <div className="shell text-center">
          <h2 className="mb-sm text-headline-md text-primary-container">
            One contract between the store and its content
          </h2>
          <p className="mx-auto mb-md max-w-[42rem] text-body-md text-on-surface-variant">
            The storefront never opens a database connection or hand-rolls a
            fetch. It reads through the <code>@orbit/next</code> SDK, which owns
            the read contract on both sides — so what an editor publishes is
            what a visitor sees.
          </p>
          <ul className="flex flex-wrap justify-center gap-sm">
            {ASSURANCES.map((item) => (
              <li
                key={item}
                className="flex items-center gap-xs rounded-full border border-border-subtle bg-surface px-sm py-xs text-label-md text-on-surface-variant shadow-sm"
              >
                <CheckIcon className="size-4 text-success-green" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -- featured products --------------------------------------------- */}
      <section className="shell py-section-gap">
        <div className="mb-lg flex items-end justify-between gap-sm">
          <h2 className="text-headline-lg tracking-wide text-primary uppercase">
            Featured products
          </h2>
          <Link
            href="/products"
            className="hidden items-center gap-xs text-label-md text-primary transition-colors hover:text-primary-container md:flex"
          >
            View all
            <ArrowRightIcon className="size-5" />
          </Link>
        </div>

        {featured.length > 0 ? (
          <ul className="grid grid-cols-12 gap-md">
            {featured.map((product) => (
              <FeaturedCard key={product.id} product={product} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-lg text-body-md text-on-surface-variant shadow-card">
            {reachable
              ? "Nothing is published yet. Products appear here as soon as an editor publishes them in Orbit."
              : "The catalog is temporarily unreachable. It comes back on its own — please try again in a moment."}
          </p>
        )}
      </section>

      {/* -- explainer ------------------------------------------------------ */}
      <section className="border-t border-outline-variant bg-surface-container-lowest py-section-gap">
        <div className="shell grid grid-cols-1 items-start gap-lg md:grid-cols-2">
          <div>
            <h2 className="mb-md text-headline-lg text-primary">
              How this storefront works
            </h2>
            <p className="mb-md text-body-md text-on-surface-variant">
              Orbit splits the job in two: an admin where the catalog is written,
              and this site, which only reads. The boundary is enforced in code —
              a direct database import here is a build error, not a review note.
            </p>
            <ul className="flex flex-col gap-md">
              {STEPS.map((step) => (
                <li key={step.title} className="flex items-start gap-sm">
                  <span className="mt-base shrink-0 rounded-full bg-secondary-fixed/30 p-xs text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <div>
                    <strong className="mb-base block text-headline-sm text-on-surface">
                      {step.title}
                    </strong>
                    <span className="text-body-md text-on-surface-variant">
                      {step.body}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-muted p-lg">
            <h3 className="mb-sm text-headline-md text-on-surface">
              What isn&apos;t here yet
            </h3>
            <p className="mb-md text-body-md text-on-surface-variant">
              The SDK is read-only today, so this storefront can show a catalog
              but cannot take an order. These arrive once the admin owns the
              contract for them:
            </p>
            <ol className="mb-md list-inside list-decimal text-body-md text-on-surface-variant">
              <li className="mb-xs">A cart that survives a page load</li>
              <li className="mb-xs">Checkout and payment</li>
              <li>Orders an editor can see in the admin</li>
            </ol>
            <Link
              href="/products"
              className="block rounded-DEFAULT bg-primary px-lg py-sm text-center text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Browse the catalog
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
