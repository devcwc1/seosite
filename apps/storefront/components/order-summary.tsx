import type { ResolvedLine } from "@/lib/cart";
import { formatPrice } from "@/lib/orbit";

/**
 * The summary sidebar shared by the cart and both checkout steps.
 *
 * Shipping and VAT are shown as "Not configured" rather than as numbers:
 * Orbit carries neither a shipping table nor a tax rate, and both are figures
 * with legal weight. Orders record whatever was actually applied.
 */
export function OrderSummary({
  lines,
  subtotalCents,
  children,
}: {
  lines: ResolvedLine[];
  subtotalCents: number;
  children?: React.ReactNode;
}) {
  const currency = lines[0]?.product.currency ?? "EUR";
  const money = (cents: number) => formatPrice({ priceCents: cents, currency });

  return (
    <aside className="h-fit w-full rounded-xl border border-border-subtle bg-surface-muted p-md lg:sticky lg:top-[8rem] lg:w-80 lg:shrink-0">
      <h2 className="mb-md border-b border-outline-variant pb-xs text-headline-sm">
        Order summary
      </h2>

      <ul className="mb-md flex flex-col gap-sm border-b border-outline-variant pb-md">
        {lines.map(({ product, quantity, lineTotalCents }) => (
          <li key={product.id} className="flex justify-between gap-sm text-body-sm">
            <span>
              <span className="block text-on-surface">{product.title}</span>
              <span className="text-on-surface-variant">
                Quantity: {quantity}
              </span>
            </span>
            <span className="tabular-nums">{money(lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-xs text-body-md">
        <div className="flex justify-between gap-sm">
          <dt className="text-on-surface-variant">Subtotal</dt>
          <dd className="tabular-nums">{money(subtotalCents)}</dd>
        </div>
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
          <dd className="tabular-nums">{money(subtotalCents)}</dd>
        </div>
      </dl>

      {children ? <div className="mt-md">{children}</div> : null}
    </aside>
  );
}
