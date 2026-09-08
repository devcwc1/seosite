import Link from "next/link";
import type { StorefrontProduct } from "@orbit/next";

import { formatPrice, primaryCategory, primaryImage } from "@/lib/orbit";

import { ArrowRightIcon, ImagePlaceholderIcon } from "./icons";
import { StockBadge } from "./stock-badge";

/**
 * A level-1 card: white on the tonal floor, soft border, lifting on hover.
 * The whole card is the link — the arrow is an affordance inside it, not a
 * second control, so there is one target per product.
 */
export function ProductCard({ product }: { product: StorefrontProduct }) {
  const image = primaryImage(product);
  const category = primaryCategory(product);

  return (
    <li>
      <Link
        href={`/products/${product.slug}`}
        className="hover-lift group relative flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-card"
      >
        <StockBadge
          inStock={product.inStock}
          className="absolute top-sm left-sm z-10"
        />

        <div className="mb-md flex aspect-square items-center justify-center overflow-hidden rounded-DEFAULT bg-surface">
          {image ? (
            /* Images are arbitrary remote URLs from the content API, so they
               bypass next/image's host allow-list. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt ?? product.title}
              className="max-h-full object-contain p-sm"
            />
          ) : (
            <ImagePlaceholderIcon className="size-10 text-outline" />
          )}
        </div>

        {category ? (
          <p className="mb-xs text-label-md text-on-surface-variant uppercase">
            {category.name}
          </p>
        ) : null}

        <h2 className="mb-xs text-headline-md text-on-surface">
          {product.title}
        </h2>

        {product.shortInfo ? (
          <p className="mb-lg grow text-body-sm leading-snug text-on-surface-variant">
            {product.shortInfo}
          </p>
        ) : (
          <div className="grow" />
        )}

        <div className="mt-auto flex items-center justify-between">
          <span className="text-headline-md text-primary">
            {formatPrice(product)}
          </span>
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition group-hover:brightness-110"
          >
            <ArrowRightIcon className="size-5" />
          </span>
        </div>
      </Link>
    </li>
  );
}
