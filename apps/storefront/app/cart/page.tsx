import Link from "next/link";

import { ArrowRightIcon, CartIcon } from "@/components/icons";

export const metadata = {
  title: "Cart",
};

/**
 * Cart / checkout placeholder.
 *
 * `@orbit/next` is read-only today (`listProducts` / `getProduct`); it exposes
 * no cart or order contract, so there is nothing for this route to consume yet.
 * It stays a static placeholder until the SDK owns those writes — deliberately
 * no local cart state, so no throwaway contract has to be unwound later.
 */
export default function CartPage() {
  return (
    <div className="shell py-xl">
      <div className="mx-auto max-w-[36rem] rounded-xl border border-outline-variant bg-surface-container-lowest p-lg text-center shadow-card">
        <span className="mx-auto mb-md flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <CartIcon className="size-7" />
        </span>

        <h1 className="mb-xs text-headline-lg text-on-surface">
          Your cart is empty
        </h1>
        <p className="mb-lg text-body-md text-on-surface-variant">
          Checkout isn&apos;t implemented in this reference storefront — Orbit
          publishes catalogue content, and the ordering contract doesn&apos;t
          exist yet.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-xs whitespace-nowrap rounded-DEFAULT bg-primary px-lg py-sm text-body-md font-semibold text-on-primary shadow-card transition hover:brightness-110"
        >
          Browse the catalog
          <ArrowRightIcon className="size-5" />
        </Link>
      </div>
    </div>
  );
}
