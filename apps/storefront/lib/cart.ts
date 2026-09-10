import { cookies } from "next/headers";
import type { StorefrontProduct } from "@orbit/next";

/**
 * The cart lives in a cookie, keyed by product slug.
 *
 * Orbit is read-only today, so there is no server-side cart to talk to. A
 * cookie keeps the cart readable during server rendering — the header badge
 * and the cart page both need it before any JavaScript runs — and it survives
 * a reload without inventing a persistence contract that would have to be
 * unwound when the admin owns orders.
 */
export type CartLine = { slug: string; quantity: number };

/** A cart line joined to the product it refers to. */
export type ResolvedLine = {
  product: StorefrontProduct;
  quantity: number;
  lineTotalCents: number;
};

export const CART_COOKIE = "orbit_cart";
export const MAX_QUANTITY = 99;

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function normalize(lines: unknown): CartLine[] {
  if (!Array.isArray(lines)) return [];

  return lines
    .filter(
      (line): line is CartLine =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as CartLine).slug === "string" &&
        Number.isFinite((line as CartLine).quantity),
    )
    .map((line) => ({
      slug: line.slug,
      quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(line.quantity))),
    }))
    .slice(0, 50);
}

/** The cart as stored. Unparseable cookies are treated as an empty cart. */
export async function readCart(): Promise<CartLine[]> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return [];

  try {
    return normalize(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Only callable from a server action or route handler. */
export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  const clean = normalize(lines);

  if (clean.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }

  store.set(CART_COOKIE, JSON.stringify(clean), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Total item count — what the header badge shows. */
export function countItems(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Join cart lines to live catalog data. A line whose product is no longer
 * published simply disappears: the price and title must come from the
 * catalog, never from the cookie, so a stale cart can never quote a stale
 * price.
 */
export function resolveLines(
  lines: CartLine[],
  products: StorefrontProduct[],
): ResolvedLine[] {
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  return lines.flatMap((line) => {
    const product = bySlug.get(line.slug);
    if (!product) return [];

    return [
      {
        product,
        quantity: line.quantity,
        lineTotalCents: product.priceCents * line.quantity,
      },
    ];
  });
}

export function subtotalCents(resolved: ResolvedLine[]): number {
  return resolved.reduce((total, line) => total + line.lineTotalCents, 0);
}
