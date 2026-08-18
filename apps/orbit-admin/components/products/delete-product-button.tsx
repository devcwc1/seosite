"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteProductAction } from "@/app/(protected)/products/actions";
import { Button } from "@/components/ui/button";

export function DeleteProductButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProductAction(id);
      if (result.ok) {
        router.refresh();
      } else {
        window.alert(result.errors.form ?? "Failed to delete product.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={onDelete}
    >
      <Trash2 className="size-4" aria-hidden />
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
