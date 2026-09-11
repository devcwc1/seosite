"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteCategoryAction } from "@/app/(protected)/categories/actions";
import { Button } from "@/components/ui/button";

export function DeleteCategoryButton({
  id,
  name,
  productCount,
}: {
  id: string;
  name: string;
  productCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A category holding products is refused server-side anyway; disabling the
  // button here just avoids offering an action that cannot succeed.
  const blocked = productCount > 0;

  function onDelete() {
    if (!window.confirm(`Delete the "${name}" archive page?`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (result.ok) router.refresh();
      else setError(result.error ?? "Delete failed.");
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={
          blocked ? `Cannot delete ${name}: it still holds products` : `Delete ${name}`
        }
        title={blocked ? "Move its products first" : undefined}
        disabled={isPending || blocked}
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </span>
  );
}
