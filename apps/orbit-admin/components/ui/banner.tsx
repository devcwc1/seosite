"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status/registry";

/**
 * A page-level message: the thing that says "3 products failed to sync" at
 * the top of a screen. Distinct from a toast, which is transient, and from
 * an inline field error, which belongs to one input.
 *
 * Tones come from the same five as StatusChip, so a warning banner and a
 * warning chip on the same screen cannot disagree about what warning means.
 */
const TONE: Record<
  Exclude<StatusTone, "neutral">,
  { className: string; Icon: typeof Info; role: "status" | "alert" }
> = {
  info: {
    className: "bg-status-info text-status-info-foreground",
    Icon: Info,
    role: "status",
  },
  success: {
    className: "bg-status-success text-status-success-foreground",
    Icon: CheckCircle2,
    role: "status",
  },
  warning: {
    className: "bg-status-warning text-status-warning-foreground",
    Icon: TriangleAlert,
    role: "status",
  },
  // Only danger interrupts: `role="alert"` preempts whatever a screen reader
  // is currently saying, which is right for a failure and rude for anything else.
  danger: {
    className: "bg-status-danger text-status-danger-foreground",
    Icon: AlertCircle,
    role: "alert",
  },
};

export type BannerProps = {
  tone: keyof typeof TONE;
  title: string;
  children?: React.ReactNode;
  /** Renders a dismiss button. Omit for a message that must stay put. */
  onDismiss?: () => void;
  className?: string;
};

export function Banner({
  tone,
  title,
  children,
  onDismiss,
  className,
}: BannerProps) {
  const { className: toneClass, Icon, role } = TONE[tone];

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-lg px-4 py-3",
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">{title}</p>
        {children ? <div className="text-body mt-1">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          // The icon carries no text, so the name comes from aria-label and
          // includes the title — "Dismiss" alone is meaningless in a list of
          // controls read out of context.
          aria-label={`Dismiss: ${title}`}
          className="focus-visible:ring-ring/50 -mr-1 shrink-0 rounded-md p-1 outline-none hover:bg-black/5 focus-visible:ring-[3px] dark:hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
