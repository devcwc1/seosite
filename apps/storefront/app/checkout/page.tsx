import { redirect } from "next/navigation";

import { CheckoutStepper } from "@/components/checkout-stepper";
import { OrderSummary } from "@/components/order-summary";
import { readCart, resolveLines, subtotalCents } from "@/lib/cart";
import { COUNTRIES, readCheckoutDetails } from "@/lib/checkout";
import { saveDetailsAction } from "@/lib/checkout-actions";
import { orbit } from "@/lib/orbit";

export const metadata = {
  title: "Checkout",
};

const inputClass =
  "w-full rounded-DEFAULT border border-border-subtle bg-surface-container-lowest px-sm py-xs text-body-md transition-colors focus:border-primary-container focus:outline-none";

function Field({
  label,
  name,
  type = "text",
  required = true,
  placeholder,
  defaultValue,
  autoComplete,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="mb-xs block text-body-sm text-on-surface-variant"
      >
        {label}
        {required ? "" : " (optional)"}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className={inputClass}
      />
    </div>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const lines = await readCart();
  if (lines.length === 0) redirect("/cart");

  const products = await orbit.listProducts();
  const resolved = resolveLines(lines, products);
  if (resolved.length === 0) redirect("/cart");

  const details = await readCheckoutDetails();

  return (
    <main className="shell py-section-gap">
      <h1 className="mb-md text-headline-lg text-on-surface md:text-display-lg">
        Checkout
      </h1>
      <CheckoutStepper current={1} />

      {error ? (
        <p className="mb-md rounded-lg border border-error bg-error-container p-sm text-body-sm text-on-error-container">
          Some required details are missing. Please complete every field marked
          as required.
        </p>
      ) : null}

      <div className="flex flex-col gap-gutter lg:flex-row">
        <form action={saveDetailsAction} className="flex flex-1 flex-col gap-lg">
          <section>
            <h2 className="mb-sm text-headline-sm text-on-surface">
              Contact details
            </h2>
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <Field
                label="Email address"
                name="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                defaultValue={details?.email}
              />
              <Field
                label="Phone number"
                name="phone"
                type="tel"
                required={false}
                placeholder="+31 6 12345678"
                autoComplete="tel"
                defaultValue={details?.phone}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-sm text-headline-sm text-on-surface">
              Shipping address
            </h2>
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <Field
                label="Full name"
                name="name"
                autoComplete="name"
                defaultValue={details?.name}
                className="sm:col-span-2"
              />
              <Field
                label="Street and number"
                name="street"
                autoComplete="street-address"
                defaultValue={details?.street}
                className="sm:col-span-2"
              />
              <Field
                label="Postcode"
                name="postcode"
                placeholder="1234 AB"
                autoComplete="postal-code"
                defaultValue={details?.postcode}
              />
              <Field
                label="City"
                name="city"
                autoComplete="address-level2"
                defaultValue={details?.city}
              />
              <div className="sm:col-span-2">
                <label
                  htmlFor="country"
                  className="mb-xs block text-body-sm text-on-surface-variant"
                >
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  required
                  defaultValue={details?.country ?? "NL"}
                  autoComplete="country"
                  className={inputClass}
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-sm text-headline-sm text-on-surface">
              Shipping method
            </h2>
            {/* The design offers a standard option and a pickup point. Orbit
                has no shipping table, so there is exactly one thing to say
                here, and it is said rather than dressed up as a choice. */}
            <p className="rounded-lg border border-border-subtle bg-surface-muted p-md text-body-md text-on-surface-variant">
              No shipping methods are configured yet. Your order will be
              recorded without a delivery option, and someone will follow up.
            </p>
          </section>

          <button
            type="submit"
            className="self-start rounded-DEFAULT bg-primary px-lg py-sm text-label-md text-on-primary shadow-card transition-colors hover:bg-primary-container"
          >
            Continue to payment
          </button>
        </form>

        <OrderSummary lines={resolved} subtotalCents={subtotalCents(resolved)} />
      </div>
    </main>
  );
}
