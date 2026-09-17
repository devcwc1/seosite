import Link from "next/link";

import {
  ArrowRightIcon,
  CartIcon,
  ImagePlaceholderIcon,
  ShieldIcon,
} from "@/components/icons";
import {
  clearCartAction,
  removeLineAction,
  setQuantityAction,
} from "@/lib/cart-actions";
import {
  MAX_QUANTITY,
  readCart,
  resolveLines,
  subtotalCents,
} from "@/lib/cart";
import { formatPrice, orbit, primaryImage } from "@/lib/orbit";

export const metadata = {
  title: "Cart",
  // One shopper's cart or order is never something to find in a search engine.
  robots: { index: false, follow: false },
};

function money(cents: number, currency: string) {
  return formatPrice({ priceCents: cents, currency });
}

function EmptyCart({ reason }: { reason?: string }) {
  return (
    <div className="mx-auto max-w-[36rem] rounded-xl border border-outline-variant bg-surface-container-lowest p-lg text-center shadow-card">
      <span className="mx-auto mb-md flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <CartIcon className="size-7" />
      </span>
      <h1 className="mb-xs text-headline-lg text-on-surface">
        Your cart is empty
      </h1>
      <p className="mb-lg text-body-md text-on-surface-variant">
        {reason ??
          "Nothing added yet. Every product in the catalog can be added from its page."}
      </p>
      <Link
        href="/products"
        className="inline-flex items-center gap-xs whitespace-nowrap rounded-DEFAULT bg-primary px-lg py-sm text-body-md font-semibold text-on-primary shadow-card transition hover:brightness-110"
      >
        Browse the catalog
        <ArrowRightIcon className="size-5" />
      </Link>
    </div>
  );
}

export default async function CartPage() {
  const lines = await readCart();

  if (lines.length === 0) {
    return (
      <div className="shell py-section-gap">
        <EmptyCart />
      </div>
    );
  }

  let products;
  try {
    products = await orbit.listProducts();
  } catch {
    return (
      <div className="shell py-section-gap">
        <EmptyCart reason="The catalog is temporarily unreachable, so your cart cannot be priced. Your items are still saved — please try again in a moment." />
      </div>
    );
  }

  const resolved = resolveLines(lines, products);

  if (resolved.length === 0) {
    return (
      <div className="shell py-section-gap">
        <EmptyCart reason="The products in your cart are no longer published." />
      </div>
    );
  }

  const currency = resolved[0]!.product.currency;
  const subtotal = subtotalCents(resolved);
  const dropped = lines.length - resolved.length;

  return (
    <main className="shell py-section-gap">
      <div className="mb-lg">
        <h1 className="text-headline-lg text-on-surface md:text-display-lg">
          Cart
        </h1>
        <p className="mt-sm text-body-lg text-on-surface-variant">
          Check your order before going further.
        </p>
      </div>

      {dropped > 0 ? (
        <p className="mb-md rounded-lg border border-outline-variant bg-surface-container-lowest p-sm text-body-sm text-on-surface-variant">
          {dropped} {dropped === 1 ? "item was" : "items were"} removed because{" "}
          {dropped === 1 ? "it is" : "they are"} no longer published.
        </p>
      ) : null}

      <div className="flex flex-col gap-gutter lg:flex-row">
        {/* -- lines ------------------------------------------------------ */}
        <div className="flex-1">
          <div className="hidden grid-cols-[1fr_10rem_8rem] gap-sm border-b border-border-subtle pb-xs text-label-md text-on-surface-variant uppercase md:grid">
            <span>Product</span>
            <span>Quantity</span>
            <span className="text-right">Price</span>
          </div>

          <ul className="flex flex-col">
            {resolved.map(({ product, quantity, lineTotalCents }) => {
              const image = primaryImage(product);

              return (
                <li
                  key={product.id}
                  className="grid grid-cols-1 gap-sm border-b border-border-subtle py-md md:grid-cols-[1fr_10rem_8rem] md:items-center"
                >
                  <div className="flex items-center gap-sm">
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-DEFAULT border border-border-subtle bg-surface-muted">
                      {image ? (
                        /* Remote URLs bypass next/image's allow-list. */
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.url}
                          alt={image.alt ?? product.title}
                          className="max-h-full object-contain p-xs"
                        />
                      ) : (
                        <ImagePlaceholderIcon className="size-6 text-outline" />
                      )}
                    </div>

                    <div>
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-headline-sm text-on-surface transition-colors hover:text-primary"
                      >
                        {product.title}
                      </Link>
                      <p className="text-body-sm text-on-surface-variant">
                        {formatPrice(product)} each
                      </p>
                      {!product.inStock ? (
                        <p className="text-body-sm text-on-secondary-container">
                          Currently out of stock
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <form
                    action={setQuantityAction}
                    className="flex items-center gap-xs"
                  >
                    <input type="hidden" name="slug" value={product.slug} />
                    <label
                      htmlFor={`qty-${product.id}`}
                      className="sr-only"
                    >
                      Quantity for {product.title}
                    </label>
                    <input
                      id={`qty-${product.id}`}
                      type="number"
                      name="quantity"
                      min={1}
                      max={MAX_QUANTITY}
                      defaultValue={quantity}
                      className="w-16 rounded-DEFAULT border border-border-subtle bg-surface-container-lowest px-xs py-xs text-center text-body-md"
                    />
                    <button
                      type="submit"
                      className="rounded-DEFAULT border border-outline-variant px-xs py-xs text-body-sm text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                    >
                      Update
                    </button>
                  </form>

                  <div className="flex items-center justify-between gap-sm md:flex-col md:items-end">
                    <span className="text-price-display text-primary tabular-nums">
                      {money(lineTotalCents, product.currency)}
                    </span>
                    <form action={removeLineAction}>
                      <input type="hidden" name="slug" value={product.slug} />
                      <button
                        type="submit"
                        className="text-body-sm text-on-surface-variant underline-offset-2 transition-colors hover:text-primary hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
            <Link
              href="/products"
              className="text-body-sm text-primary underline-offset-2 hover:underline"
            >
              ← Continue shopping
            </Link>
            <form action={clearCartAction}>
              <button
                type="submit"
                className="text-body-sm text-on-surface-variant underline-offset-2 transition-colors hover:text-primary hover:underline"
              >
                Empty cart
              </button>
            </form>
          </div>
        </div>

        {/* -- summary ---------------------------------------------------- */}
        <aside className="h-fit w-full rounded-xl border border-border-subtle bg-surface-muted p-md lg:sticky lg:top-[8rem] lg:w-80 lg:shrink-0">
          <h2 className="mb-md border-b border-outline-variant pb-xs text-headline-sm">
            Order summary
          </h2>

          <dl className="mb-md flex flex-col gap-xs text-body-md">
            <div className="flex justify-between gap-sm">
              <dt className="text-on-surface-variant">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal, currency)}</dd>
            </div>
            {/* The design lists shipping and VAT here. Both are real figures
                with legal weight, and Orbit carries neither a shipping table
                nor a tax rate — so they are named as pending rather than
                guessed at. */}
            <div className="flex justify-between gap-sm">
              <dt className="text-on-surface-variant">Shipping</dt>
              <dd className="text-on-surface-variant">Not configured</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-on-surface-variant">VAT</dt>
              <dd className="text-on-surface-variant">Not configured</dd>
            </div>
            <div className="mt-xs flex justify-between gap-sm border-t border-outline-variant pt-sm text-headline-sm">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(subtotal, currency)}</dd>
            </div>
          </dl>

          <Link
            href="/checkout"
            className="mb-sm block w-full rounded-DEFAULT bg-primary px-lg py-sm text-center text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            Checkout
          </Link>
          <p className="mb-md text-body-sm text-on-surface-variant">
            Orders are recorded in Orbit as pending — no payment provider is
            connected yet.
          </p>

          <p className="flex items-start gap-xs border-t border-outline-variant pt-sm text-body-sm text-on-surface-variant">
            <ShieldIcon className="mt-base size-4 shrink-0 text-primary" />
            Prices come from the catalog on every render, so a cart left open
            can never quote a stale price.
          </p>
        </aside>
      </div>
    </main>
  );
}
