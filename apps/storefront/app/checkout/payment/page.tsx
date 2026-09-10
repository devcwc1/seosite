import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutStepper } from "@/components/checkout-stepper";
import { OrderSummary } from "@/components/order-summary";
import { ShieldIcon } from "@/components/icons";
import { readCart, resolveLines, subtotalCents } from "@/lib/cart";
import { COUNTRIES, isComplete, readCheckoutDetails } from "@/lib/checkout";
import { placeOrderAction } from "@/lib/checkout-actions";
import { orbit } from "@/lib/orbit";

export const metadata = {
  title: "Payment",
};

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [lines, details] = await Promise.all([
    readCart(),
    readCheckoutDetails(),
  ]);
  if (lines.length === 0) redirect("/cart");
  if (!isComplete(details)) redirect("/checkout?error=missing");

  const products = await orbit.listProducts();
  const resolved = resolveLines(lines, products);
  if (resolved.length === 0) redirect("/cart");

  const country =
    COUNTRIES.find((item) => item.code === details!.country)?.name ??
    details!.country;

  return (
    <main className="shell py-section-gap">
      <h1 className="mb-md text-headline-lg text-on-surface md:text-display-lg">
        Payment
      </h1>
      <CheckoutStepper current={2} />

      {error ? (
        <p className="mb-md rounded-lg border border-error bg-error-container p-sm text-body-sm text-on-error-container">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-gutter lg:flex-row">
        <div className="flex flex-1 flex-col gap-lg">
          <section>
            <h2 className="mb-sm text-headline-sm text-on-surface">
              Payment method
            </h2>
            {/* The design offers iDEAL with a bank picker, card and Bancontact.
                Each of those runs through a payment provider that isn't
                integrated; rendering them as choices would be a fiction, and
                collecting card numbers on our own form would be worse. */}
            <div className="rounded-lg border border-border-subtle bg-surface-muted p-md">
              <p className="mb-sm text-body-md text-on-surface">
                No payment provider is connected yet.
              </p>
              <p className="text-body-md text-on-surface-variant">
                Your order will be recorded as <strong>pending</strong> and is
                visible to the shop straight away. iDEAL, Bancontact and card
                payments each need a provider integration before money can
                actually move.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-sm text-headline-sm text-on-surface">
              Delivering to
            </h2>
            <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-md text-body-md">
              <p className="text-on-surface">{details!.name}</p>
              <p className="text-on-surface-variant">{details!.street}</p>
              <p className="text-on-surface-variant">
                {details!.postcode} {details!.city}, {country}
              </p>
              <p className="mt-xs text-on-surface-variant">{details!.email}</p>
              {details!.phone ? (
                <p className="text-on-surface-variant">{details!.phone}</p>
              ) : null}
              <Link
                href="/checkout"
                className="mt-sm inline-block text-body-sm text-primary underline-offset-2 hover:underline"
              >
                Edit details
              </Link>
            </div>
          </section>

          <form action={placeOrderAction}>
            <button
              type="submit"
              className="w-full rounded-DEFAULT bg-primary px-lg py-sm text-label-md text-on-primary shadow-card transition-colors hover:bg-primary-container sm:w-auto"
            >
              Place order
            </button>
          </form>
        </div>

        <OrderSummary lines={resolved} subtotalCents={subtotalCents(resolved)}>
          <p className="flex items-start gap-xs border-t border-outline-variant pt-sm text-body-sm text-on-surface-variant">
            <ShieldIcon className="mt-base size-4 shrink-0 text-primary" />
            Every price is recalculated by Orbit when the order is placed — the
            amount recorded is the catalog&apos;s, not the browser&apos;s.
          </p>
        </OrderSummary>
      </div>
    </main>
  );
}
