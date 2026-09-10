import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { CheckoutStepper } from "@/components/checkout-stepper";

export const metadata = {
  title: "Order confirmed",
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  if (!order) redirect("/");

  const today = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date());

  return (
    <main className="shell py-section-gap">
      <CheckoutStepper current={3} />

      <div className="mx-auto max-w-[40rem] rounded-xl border border-border-subtle bg-surface-container-lowest p-lg text-center shadow-card">
        <span className="mx-auto mb-md flex size-16 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
          <CheckIcon className="size-8" />
        </span>

        <h1 className="mb-xs text-headline-lg text-on-surface">
          Thank you for your order
        </h1>
        <p className="mb-lg text-body-md text-on-surface-variant">
          It has been recorded and is visible to the shop.
        </p>

        <dl className="mb-lg rounded-lg border border-border-subtle bg-surface-muted p-md text-left">
          <div className="flex justify-between gap-sm border-b border-outline-variant py-xs">
            <dt className="text-on-surface-variant">Order number</dt>
            <dd className="font-semibold tabular-nums text-on-surface">
              {order}
            </dd>
          </div>
          <div className="flex justify-between gap-sm border-b border-outline-variant py-xs">
            <dt className="text-on-surface-variant">Date</dt>
            <dd className="text-on-surface">{today}</dd>
          </div>
          <div className="flex justify-between gap-sm py-xs">
            <dt className="text-on-surface-variant">Status</dt>
            <dd className="text-on-surface">Pending payment</dd>
          </div>
        </dl>

        {/* The design promises an email confirmation. Nothing sends mail here,
            so the page says what actually happens instead. */}
        <p className="mb-lg text-body-sm text-on-surface-variant">
          No confirmation email is sent — this storefront has no mail service
          connected. Write your order number down; it is the only reference you
          have, since there are no customer accounts yet.
        </p>

        <Link
          href="/products"
          className="inline-flex items-center gap-xs rounded-DEFAULT bg-primary px-lg py-sm text-label-md text-on-primary shadow-card transition-colors hover:bg-primary-container"
        >
          Continue shopping
          <ArrowRightIcon className="size-5" />
        </Link>
      </div>
    </main>
  );
}
