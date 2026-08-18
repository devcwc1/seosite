import Link from "next/link";

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
    <section>
      <h1>Cart</h1>

      <p>
        Your cart is empty. Checkout is not implemented in this reference
        storefront.
      </p>

      <Link href="/">Continue shopping</Link>
    </section>
  );
}
