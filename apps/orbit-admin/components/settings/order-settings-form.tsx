"use client";

import { useState, useTransition } from "react";

import { saveOrderSettingsAction } from "@/app/(protected)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OrderSettingsForm({
  shippingCents,
  taxRateBp,
  configured,
  canEdit,
}: {
  shippingCents: number;
  taxRateBp: number;
  /** False while the values are inherited from env rather than saved. */
  configured: boolean;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveOrderSettingsAction(formData);
      if (result.ok) setSaved(true);
      else setError(result.error ?? "Could not save.");
    });
  }

  return (
    <form action={onSubmit} className="flex max-w-md flex-col gap-4">
      <div className="grid gap-2">
        <label htmlFor="shipping" className="text-sm font-medium">
          Shipping charge
        </label>
        <Input
          id="shipping"
          name="shipping"
          type="number"
          min={0}
          step="0.01"
          defaultValue={(shippingCents / 100).toFixed(2)}
          disabled={!canEdit || isPending}
        />
        <p className="text-xs text-muted-foreground">
          A flat charge added to every new order, in euros.
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="vat" className="text-sm font-medium">
          VAT rate
        </label>
        <Input
          id="vat"
          name="vat"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={(taxRateBp / 100).toFixed(2)}
          disabled={!canEdit || isPending}
        />
        <p className="text-xs text-muted-foreground">
          Percent, applied to the subtotal plus shipping. This is a legal
          figure — set it to what your accountant says, not to a guess.
        </p>
      </div>

      {!configured ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          These values are currently inherited from the environment and have
          never been saved here. Orders placed today use them as shown.
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          {saved ? (
            <span className="text-sm text-muted-foreground">
              Saved. New orders use these values.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only admins can change these.
        </p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
