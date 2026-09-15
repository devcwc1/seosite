import { cn } from "@/lib/utils";
import {
  statusEntry,
  type StatusDomain,
  type StatusTone,
  type StatusValue,
} from "@/lib/status/registry";

/**
 * The one place a status tone becomes a colour. Screens render
 * `<StatusChip domain="product" value={row.status} />` and get whatever the
 * registry says; there is deliberately no `variant` or `color` prop to
 * override, because an override is how per-screen drift starts.
 */
const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-status-neutral text-status-neutral-foreground",
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
  danger: "bg-status-danger text-status-danger-foreground",
  info: "bg-status-info text-status-info-foreground",
};

export type StatusChipProps<D extends StatusDomain> = {
  domain: D;
  value: StatusValue<D>;
  /** Layout only — spacing and alignment. Colour is not yours to set. */
  className?: string;
};

export function StatusChip<D extends StatusDomain>({
  domain,
  value,
  className,
}: StatusChipProps<D>) {
  const entry = statusEntry(domain, value);

  return (
    <span
      data-status-domain={domain}
      data-status-value={String(value)}
      data-status-tone={entry.tone}
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-4xl px-2 py-0.5",
        "text-caption font-medium whitespace-nowrap",
        TONE_CLASS[entry.tone],
        className,
      )}
    >
      {/*
        Colour is never the only carrier of meaning (WCAG 1.4.1): the label
        is always present, and anything the label leaves implicit is spoken
        through the visually hidden description.
      */}
      {entry.label}
      {entry.description ? (
        <span className="sr-only"> — {entry.description}</span>
      ) : null}
    </span>
  );
}
