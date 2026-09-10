"use client";

import { useState, useTransition } from "react";

import { setOrderStatusAction } from "@/app/(protected)/orders/actions";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/lib/db/schema";

const LABELS: Record<OrderStatus, string> = {
  pending: "Back to pending",
  paid: "Mark as paid",
  shipped: "Mark as shipped",
  cancelled: "Cancel order",
};

/**
 * Status controls. A client component only because a refusal needs to be shown
 * in place — the server action stays the authority on what is allowed.
 */
export function OrderStatusActions({
  orderId,
  next,
}: {
  orderId: string;
  next: OrderStatus[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (next.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This order has reached a final state. Reversing it — a refund, a
        restock — is a business decision, not a status change.
      </p>
    );
  }

  function move(status: OrderStatus) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", orderId);
      formData.set("status", status);

      const result = await setOrderStatusAction(formData);
      if (!result.ok) setError(result.error ?? "The change was refused.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {next.map((status) => (
          <Button
            key={status}
            type="button"
            variant={status === "cancelled" ? "outline" : "default"}
            size="sm"
            disabled={isPending}
            onClick={() => move(status)}
          >
            {LABELS[status]}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
