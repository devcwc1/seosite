"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteUserAction } from "@/app/(protected)/users/actions";
import { Button } from "@/components/ui/button";

export function DeleteUserButton({
  id,
  email,
  disabled,
}: {
  id: string;
  email: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete "${email}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteUserAction(id);
      if (result.ok) {
        router.refresh();
      } else {
        window.alert(result.errors.form ?? "Failed to delete user.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled || isPending}
      onClick={onDelete}
    >
      <Trash2 className="size-4" aria-hidden />
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
