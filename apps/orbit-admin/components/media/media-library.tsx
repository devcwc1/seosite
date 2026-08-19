"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/format";
import type { MediaDTO } from "@/lib/media/types";

export function MediaLibrary() {
  const [items, setItems] = useState<MediaDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/media?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Failed to load media");
      setItems((await res.json()) as MediaDTO[]);
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

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
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
      }
      await load(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(item: MediaDTO) {
    const label = item.originalName ?? item.filename;
    if (!window.confirm(`Delete "${label}"? This removes the file permanently.`))
      return;
    try {
      const res = await fetch(`/api/media/${item.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search media…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
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
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="ml-auto"
        >
          <Upload className="size-4" aria-hidden />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No media yet. Upload PNG, JPEG, WebP, GIF or AVIF (max 5 MB).
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
                  {item.originalName ?? item.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(item.sizeBytes)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                onClick={() => onDelete(item)}
                className="absolute top-1 right-1 bg-background/80 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
