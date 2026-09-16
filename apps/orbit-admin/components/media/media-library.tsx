"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditMediaDialog } from "@/components/media/edit-media-dialog";
import { MediaDetailDrawer } from "@/components/media/media-detail-drawer";
import { MediaThumb } from "@/components/media/media-thumb";
import { StatusChip } from "@/components/ui/status-chip";
import { formatBytes } from "@/lib/format";
import type {
  MediaAssetDTO,
  MediaListDTO,
  MediaUsageFilter,
} from "@/lib/media/types";
import {
  ACCEPTED_IMAGE_TYPES,
  uploadMedia,
} from "@/components/media/upload-media";

export function MediaLibrary({
  canWrite,
  canDelete,
}: {
  /** Viewers browse and search the library, but cannot change it. */
  canWrite: boolean;
  /**
   * Deleting is narrower than writing — admins only. Passed in rather than
   * derived here: the role lives in the session, which is server-side, and
   * this is a client component. Hiding the control is a courtesy; the route
   * refuses the request regardless (lib/media/policy.ts).
   */
  canDelete: boolean;
}) {
  const [items, setItems] = useState<MediaAssetDTO[]>([]);
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<MediaUsageFilter>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState<MediaAssetDTO | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (q: string, usageFilter: MediaUsageFilter, nextCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q, usage: usageFilter });
        if (nextCursor) params.set("cursor", nextCursor);

        const res = await fetch(`/api/v1/media?${params}`);
        if (!res.ok) throw new Error("Failed to load media");
        const page = (await res.json()) as MediaListDTO;

        // A cursor means "append"; its absence means this is a fresh filter.
        setItems((prev) => (nextCursor ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setTotal(page.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load media");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Debounced: typing a filename should not be one request per keystroke.
    const t = setTimeout(() => load(query, usage), 250);
    return () => clearTimeout(t);
  }, [query, usage, load]);

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
      await load(query, usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(item: MediaAssetDTO) {
    const label = item.title ?? item.originalName ?? item.id;
    // Deletion is soft, and saying so is the difference between someone
    // hesitating over a shared asset and someone clicking through.
    if (
      !window.confirm(
        `Remove "${label}" from the library? It stops appearing here; re-uploading the same file restores it.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/media/${item.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Delete failed");
      }
      setItems((prev) => prev.filter((m) => m.id !== item.id));
      setTotal((n) => Math.max(0, n - 1));
      setDetailId(null);
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
          aria-label="Search media by filename"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-[18rem]"
        />

        <label htmlFor="media-usage" className="sr-only">
          Filter by usage
        </label>
        <select
          id="media-usage"
          value={usage}
          onChange={(e) => setUsage(e.target.value as MediaUsageFilter)}
          className="focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2 text-body outline-none focus-visible:ring-[3px]"
        >
          <option value="all">All assets</option>
          <option value="used">Used</option>
          <option value="unused">Unused</option>
        </select>
        {canWrite ? (
          <>
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
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-body font-medium">
              {query || usage !== "all"
                ? "No assets match these filters."
                : "The library is empty."}
            </p>
            <p className="text-muted-foreground text-body">
              {query || usage !== "all"
                ? "Try a different search, or show all assets."
                : "JPEG, PNG, WebP or AVIF, up to 15 MB each."}
            </p>
            {/*
              AC3: an empty library offers upload rather than describing it.
              A sentence pointing at a button elsewhere on the page is not an
              offer, and a viewer gets neither — they cannot upload.
            */}
            {canWrite && !query && usage === "all" ? (
              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden />
                Upload your first image
              </Button>
            ) : null}
            {query || usage !== "all" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setUsage("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group bg-background relative overflow-hidden rounded-lg border"
              >
                {/*
                  The cell is a button: opening the detail drawer is the
                  primary thing to do with an asset, and a click target the
                  size of the tile beats a small icon.
                */}
                <button
                  type="button"
                  onClick={() => setDetailId(item.id)}
                  aria-label={`Details for ${item.title ?? item.originalName ?? "image"}`}
                  className="focus-visible:ring-ring/50 block w-full text-left outline-none focus-visible:ring-[3px]"
                >
                  <MediaThumb
                    src={item.url}
                    alt={item.alt ?? item.originalName ?? ""}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="p-2">
                    <p className="truncate text-caption font-medium">
                      {item.title ?? item.originalName ?? "image"}
                    </p>
                    <p className="text-muted-foreground text-caption">
                      {item.width}×{item.height} · {formatBytes(item.sizeBytes)}
                    </p>
                    <div className="mt-1">
                      <StatusChip
                        domain="mediaUsage"
                        value={item.usageCount > 0 ? "inUse" : "unused"}
                      />
                    </div>
                  </div>
                </button>

                {canDelete ? (
                  <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${item.title ?? item.originalName ?? "image"}`}
                      disabled={item.usageCount > 0}
                      title={
                        item.usageCount > 0
                          ? "Used by a product — remove it there first"
                          : undefined
                      }
                      onClick={() => onDelete(item)}
                      className="bg-background/80"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-caption" aria-live="polite">
            Showing {items.length} of {total}
          </p>
          {cursor ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => load(query, usage, cursor)}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <MediaDetailDrawer
        assetId={detailId}
        canEdit={canWrite}
        canDelete={canDelete}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onEdit={(asset) => {
          setDetailId(null);
          setEditing(asset);
        }}
        onDelete={(asset) => void onDelete(asset)}
      />

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
