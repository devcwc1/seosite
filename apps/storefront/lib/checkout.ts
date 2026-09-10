import { cookies } from "next/headers";

/**
 * Checkout details carried between the two steps.
 *
 * Same reasoning as the cart: a cookie keeps the details readable during
 * server rendering, so the payment step can show them back without a client
 * store. It holds a name and address, so it is httpOnly, short-lived, and
 * cleared the moment the order is placed.
 */
export type CheckoutDetails = {
  email: string;
  phone: string;
  name: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
};

export const CHECKOUT_COOKIE = "orbit_checkout";

/** Long enough to finish checking out, short enough not to linger. */
const MAX_AGE_SECONDS = 60 * 60 * 2;

export const COUNTRIES = [
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
] as const;

const FIELDS: (keyof CheckoutDetails)[] = [
  "email",
  "phone",
  "name",
  "street",
  "postcode",
  "city",
  "country",
];

function normalize(value: unknown): CheckoutDetails | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const details = {} as CheckoutDetails;

  for (const field of FIELDS) {
    const raw = record[field];
    if (typeof raw !== "string") return null;
    details[field] = raw.slice(0, 255);
  }

  return details;
}

export async function readCheckoutDetails(): Promise<CheckoutDetails | null> {
  const raw = (await cookies()).get(CHECKOUT_COOKIE)?.value;
  if (!raw) return null;

  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Only callable from a server action or route handler. */
export async function writeCheckoutDetails(
  details: CheckoutDetails | null,
): Promise<void> {
  const store = await cookies();

  if (!details) {
    store.delete(CHECKOUT_COOKIE);
    return;
  }

  store.set(CHECKOUT_COOKIE, JSON.stringify(details), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Every field the order endpoint requires, present and non-empty. */
export function isComplete(details: CheckoutDetails | null): boolean {
  if (!details) return false;

  return (["email", "name", "street", "postcode", "city", "country"] as const)
    .every((field) => details[field].trim() !== "");
}
