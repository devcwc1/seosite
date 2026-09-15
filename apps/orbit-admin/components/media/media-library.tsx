"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditMediaDialog } from "@/components/media/edit-media-dialog";
import { formatBytes } from "@/lib/format";
import type { MediaAssetDTO } from "@/lib/media/types";
import {
  ACCEPTED_IMAGE_TYPES,
  uploadMedia,
} from "@/components/media/upload-media";

export function MediaLibrary({
  canWrite,
}: {
  /** Viewers browse and search the library, but cannot change it. */
  canWrite: boolean;
}) {
  const [items, setItems] = useState<MediaAssetDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState<MediaAssetDTO | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/media?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Failed to load media");
      setItems((await res.json()) as MediaAssetDTO[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  async function onFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      let duplicates = 0;
      for (const file of list) {
        setProgress(0);
        const { alreadyInLibrary } = await uploadMedia(file, {
          onProgress: setProgress,
        });
        if (alreadyInLibrary) duplicates += 1;
      }
      if (duplicates > 0) {
        setNotice(
          duplicates === 1
            ? "That image was already in the library — the existing asset was reused."
            : `${duplicates} images were already in the library — the existing assets were reused.`,
        );
      }
      await load(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(item: MediaAssetDTO) {
    const label = item.originalName ?? item.id;
    if (!window.confirm(`Delete "${label}"? This removes the file permanently.`))
      return;
    try {
      const res = await fetch(`/api/v1/media/${item.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Delete failed");
      }
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  // Only a writer gets drop targets; for a viewer the area is just a frame.
  const dropHandlers = canWrite
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          void onFiles(e.dataTransfer.files);
        },
      }
    : {};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search media…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        {canWrite ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="ml-auto"
            >
              <Upload className="size-4" aria-hidden />
              {uploading ? `Uploading ${progress}%` : "Upload"}
            </Button>
          </>
        ) : null}
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
        {...dropHandlers}
        className={`rounded-lg border p-4 transition-colors ${
          canWrite ? "border-dashed" : ""
        } ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {canWrite
              ? "Drop images here or use Upload. JPEG, PNG, WebP or AVIF, max 15 MB."
              : "No media assets yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-lg border bg-background"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt ?? item.originalName ?? ""}
                  className="aspect-square w-full bg-muted object-cover"
                />
                <div className="p-2">
                  <p className="truncate text-xs font-medium">
                    {item.title ?? item.originalName ?? "image"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.width}×{item.height} · {formatBytes(item.sizeBytes)}
                  </p>
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100">
                  {canWrite ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit"
                        onClick={() => setEditing(item)}
                        className="bg-background/80"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={() => onDelete(item)}
                        className="bg-background/80"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditMediaDialog
        asset={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={(updated) =>
          setItems((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m)),
          )
        }
      />
    </div>
  );
}
