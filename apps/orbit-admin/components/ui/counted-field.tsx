"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * A text field that shows how much room is left.
 *
 * The counter is wired through `aria-describedby`, so a screen reader hears
 * the remaining count when the field takes focus rather than only sighted
 * users seeing it. It is a live region too, but a polite one: announcing
 * every keystroke would make the field unusable, so only the threshold
 * crossing is urgent enough to interrupt.
 */
type CountedProps = {
  maxLength: number;
  value: string;
  id: string;
  /** Warn this many characters before the limit. */
  warnAt?: number;
  className?: string;
};

function useCounter(value: string, maxLength: number, warnAt: number) {
  const used = value.length;
  const remaining = maxLength - used;
  return {
    used,
    remaining,
    warning: remaining <= warnAt && remaining >= 0,
    over: remaining < 0,
  };
}

function Counter({
  id,
  used,
  maxLength,
  warning,
  over,
}: {
  id: string;
  used: number;
  maxLength: number;
  warning: boolean;
  over: boolean;
}) {
  return (
    <span
      id={id}
      // Polite until it matters: an assertive region here would talk over
      // the user as they type.
      aria-live={over ? "assertive" : "polite"}
      className={cn(
        "text-caption tabular-nums",
        over
          ? "text-status-danger-foreground font-medium"
          : warning
            ? "text-status-warning-foreground"
            : "text-muted-foreground",
      )}
    >
      {used} of {maxLength} characters
      {over ? " — over the limit" : ""}
    </span>
  );
}

export function CountedInput({
  maxLength,
  value,
  id,
  warnAt = 20,
  className,
  ...props
}: CountedProps & Omit<React.ComponentProps<typeof Input>, keyof CountedProps>) {
  const counterId = `${id}-counter`;
  const { used, warning, over } = useCounter(value, maxLength, warnAt);

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        {...props}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-describedby={counterId}
        aria-invalid={over || undefined}
        className={className}
      />
      <Counter
        id={counterId}
        used={used}
        maxLength={maxLength}
        warning={warning}
        over={over}
      />
    </div>
  );
}

export function CountedTextarea({
  maxLength,
  value,
  id,
  warnAt = 40,
  className,
  ...props
}: CountedProps &
  Omit<React.ComponentProps<typeof Textarea>, keyof CountedProps>) {
  const counterId = `${id}-counter`;
  const { used, warning, over } = useCounter(value, maxLength, warnAt);

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        {...props}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-describedby={counterId}
        aria-invalid={over || undefined}
        className={className}
      />
      <Counter
        id={counterId}
        used={used}
        maxLength={maxLength}
        warning={warning}
        over={over}
      />
    </div>
  );
}
