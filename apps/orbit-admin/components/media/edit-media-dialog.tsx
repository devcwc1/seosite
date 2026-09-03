"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MediaAssetDTO } from "@/lib/media/types";

/** Edit a media asset's title and alt text. */
export function EditMediaDialog({
  asset,
  onOpenChange,
  onSaved,
}: {
  /** The asset being edited, or null when the dialog is closed. */
  asset: MediaAssetDTO | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (asset: MediaAssetDTO) => void;
}) {
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setTitle(asset.title ?? "");
      setAlt(asset.alt ?? "");
      setError(null);
    }
  }, [asset]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/media/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, alt }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to save");
      }
      const updated = (await res.json()) as MediaAssetDTO;
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit image details</DialogTitle>
        </DialogHeader>

        {asset ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.alt ?? asset.originalName ?? ""}
                className="size-16 rounded border bg-muted object-cover"
              />
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="truncate">{asset.originalName ?? "image"}</p>
                <p>
                  {asset.width}×{asset.height}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="media-title">Title</Label>
              <Input
                id="media-title"
                value={title}
                maxLength={512}
                placeholder="Short title for this image"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="media-alt">Alt text</Label>
              <Textarea
                id="media-alt"
                value={alt}
                maxLength={512}
                rows={3}
                placeholder="Describe the image for screen readers"
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
