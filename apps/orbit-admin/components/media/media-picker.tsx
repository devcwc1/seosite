"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";

import {
  ACCEPTED_IMAGE_TYPES,
  uploadMedia,
} from "@/components/media/upload-media";
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
import type { MediaAssetDTO, MediaListDTO } from "@/lib/media/types";

export type PickedMedia = { assetId: string; url: string; alt: string };

export type MediaPickerProps = {
  /** Receives the selection. One item in "single" mode, any number otherwise. */
  onAdd: (items: PickedMedia[]) => void;
  /**
   * "single" is ORB-505's pick-mode for a field that holds one asset, such as
   * the OG image: choosing replaces rather than accumulates, and the dialog
   * closes on the click instead of asking for a second confirmation.
   */
  mode?: "multiple" | "single";
  triggerLabel?: string;
  title?: string;
};

/** Pick existing assets or upload new ones (drag-drop + progress). */
export function MediaPicker({
  onAdd,
  mode = "multiple",
  triggerLabel,
  title = "Media library",
}: MediaPickerProps) {
  const single = mode === "single";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaAssetDTO[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/media");
      if (!res.ok) throw new Error("Failed to load media");
      const page = (await res.json()) as MediaListDTO;
      setItems(page.items);
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
    if (single) {
      // One asset means one click: selecting is the decision, so it is also
      // the confirmation. A second "Add selected" step would only be a way
      // to get the choice wrong twice.
      const chosen = items.find((m) => m.id === id);
      if (chosen) {
        onAdd([{ assetId: chosen.id, url: chosen.url, alt: chosen.alt ?? "" }]);
        setOpen(false);
      }
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const newlySelected = new Set(selected);
      let duplicates = 0;
      for (const file of list) {
        setProgress(0);
        const { asset, alreadyInLibrary } = await uploadMedia(file, {
          onProgress: setProgress,
        });
        if (alreadyInLibrary) duplicates += 1;
        newlySelected.add(asset.id);
      }
      setNotice(
        duplicates > 0
          ? "Already in the library — the existing asset was selected."
          : null,
      );
      await load();
      setSelected(newlySelected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function confirmAdd() {
    const chosen = items
      .filter((m) => selected.has(m.id))
      .map((m) => ({ assetId: m.id, url: m.url, alt: m.alt ?? "" }));
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
        {triggerLabel ?? (single ? "Choose image" : "Add images")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              aria-label="Upload images"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {uploading ? `Uploading ${progress}%` : "Upload new"}
            </Button>
            {single ? (
              <span className="text-sm text-muted-foreground">
                Select an image
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
            )}
          </div>

          {uploading ? (
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? (
            <p className="text-sm text-muted-foreground">{notice}</p>
          ) : null}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void onFiles(e.dataTransfer.files);
            }}
            className={cn(
              "max-h-[50vh] overflow-y-auto rounded-lg border border-dashed p-2 transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Drop images here or upload. JPEG, PNG, WebP or AVIF, max 15 MB.
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
            {single ? null : (
              <Button
                type="button"
                onClick={confirmAdd}
                disabled={selected.size === 0}
              >
                Add selected
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
