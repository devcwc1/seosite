const STEPS = ["Details", "Payment", "Confirmation"] as const;

/** The design's three-step progress bar, shown on every checkout screen. */
export function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-lg flex flex-wrap items-center gap-sm text-label-md">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;

        return (
          <li key={label} className="flex items-center gap-sm">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-xs ${
                active
                  ? "text-primary"
                  : done
                    ? "text-on-surface"
                    : "text-on-surface-variant"
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[12px] font-bold ${
                  active
                    ? "bg-primary text-on-primary"
                    : done
                      ? "bg-tertiary-fixed text-on-tertiary-fixed"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {done ? "✓" : step}
              </span>
              {label}
            </span>
            {step < STEPS.length ? (
              <span aria-hidden className="text-outline-variant">
                ——
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
