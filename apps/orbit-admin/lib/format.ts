/** Format an integer minor-unit price (e.g. cents) as a localized currency. */
export function formatPrice(
  cents: number,
  currency: string,
  locale = "de-DE",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
