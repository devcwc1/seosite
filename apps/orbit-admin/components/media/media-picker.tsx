"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaDTO } from "@/lib/media/types";

/** Opens the media library to pick existing assets or upload new ones. */
export function MediaPicker({
  onAdd,
}: {
  onAdd: (items: { url: string; alt: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaDTO[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media");
      if (!res.ok) throw new Error("Failed to load media");
      setItems((await res.json()) as MediaDTO[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      void load();
    }
  }, [open, load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const createdIds: string[] = [];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/media", { method: "POST", body });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            detail?: string;
            title?: string;
          };
          throw new Error(j.detail ?? j.title ?? "Upload failed");
        }
        const dto = (await res.json()) as MediaDTO;
        createdIds.push(dto.id);
      }
      await load();
      setSelected((prev) => {
        const next = new Set(prev);
        createdIds.forEach((id) => next.add(id));
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function confirmAdd() {
    const chosen = items
      .filter((m) => selected.has(m.id))
      .map((m) => ({ url: m.url, alt: m.alt ?? "" }));
    onAdd(chosen);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <ImagePlus className="size-4" aria-hidden />
        Add images
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {uploading ? "Uploading…" : "Upload new"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No media yet — upload some.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {items.map((m) => {
                  const isSelected = selected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={cn(
                        "relative overflow-hidden rounded-md border",
                        isSelected && "ring-2 ring-primary",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt={m.alt ?? m.originalName ?? ""}
                        className="aspect-square w-full bg-muted object-cover"
                      />
                      {isSelected ? (
                        <span className="absolute top-1 right-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              type="button"
              onClick={confirmAdd}
              disabled={selected.size === 0}
            >
              Add selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
