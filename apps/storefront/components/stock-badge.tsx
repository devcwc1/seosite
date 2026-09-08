import { CheckIcon, ClockIcon } from "./icons";

/**
 * Availability reads as information, not as an alert: in-stock uses the
 * design's teal counterweight, and only the out-of-stock case borrows the
 * softened red. Shape (pill) plus icon carry the state as well as colour.
 */
export function StockBadge({
  inStock,
  className = "",
}: {
  inStock: boolean;
  className?: string;
}) {
  const tone = inStock
    ? "bg-tertiary-fixed text-on-tertiary-fixed"
    : "bg-secondary-fixed text-on-secondary-fixed";

  return (
    <span className={`pill ${tone} ${className}`.trim()}>
      {inStock ? (
        <CheckIcon className="size-4" />
      ) : (
        <ClockIcon className="size-4" />
      )}
      {inStock ? "In stock" : "Out of stock"}
    </span>
  );
}
