"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";

import {
  addProductImagesAction,
  removeProductImageAction,
} from "@/app/(protected)/products/actions";
import {
  ACCEPTED_IMAGE_TYPES,
  uploadMedia,
} from "@/components/media/upload-media";
import { MediaPicker, type PickedMedia } from "@/components/media/media-picker";
import { Button } from "@/components/ui/button";

export type GalleryImage = { assetId: string; url: string; alt: string };

/**
 * Detail-page gallery manager. Uploads auto-associate with this product via the
 * `productId` upload path (server links them on the way in); "Add from library"
 * links already-uploaded assets. Every change re-fetches via `router.refresh()`.
 */
export function ProductGalleryManager({
  productId,
  images,
  canWrite,
}: {
  productId: string;
  images: GalleryImage[];
  /** Viewers see the same gallery without any way to change it. */
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = uploading || isPending;

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
        // productId makes the server auto-associate the asset with this product.
        const { alreadyInLibrary } = await uploadMedia(file, {
          productId,
          onProgress: setProgress,
        });
        if (alreadyInLibrary) duplicates += 1;
      }
      if (duplicates > 0) {
        setNotice(
          duplicates === 1
            ? "That image was already in the library — the existing asset was linked."
            : `${duplicates} images were already in the library — the existing assets were linked.`,
        );
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onAddFromLibrary(picked: PickedMedia[]) {
    if (picked.length === 0) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await addProductImagesAction(
        productId,
        picked.map((p) => p.assetId),
      );
      if (result.ok) router.refresh();
      else setError(result.error ?? "Failed to add images.");
    });
  }

  function onRemove(image: GalleryImage) {
    if (!window.confirm("Remove this image from the product?")) return;
    setError(null);
    startTransition(async () => {
      const result = await removeProductImageAction(productId, image.assetId);
      if (result.ok) router.refresh();
      else setError(result.error ?? "Failed to remove image.");
    });
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
      {canWrite ? (
        <div className="flex items-center gap-3">
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
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            {uploading ? `Uploading ${progress}%` : "Upload & attach"}
          </Button>
          <MediaPicker onAdd={onAddFromLibrary} />
        </div>
      ) : null}

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
        {images.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {canWrite
              ? "Drop images here to attach them to this product, or use the buttons above. JPEG, PNG, WebP or AVIF, max 15 MB."
              : "No images are attached to this product."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <div
                key={image.assetId}
                className="group relative overflow-hidden rounded-lg border bg-background"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt || "Product image"}
                  className="aspect-square w-full bg-muted object-cover"
                />
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove image"
                    disabled={busy}
                    onClick={() => onRemove(image)}
                    className="absolute top-1 right-1 bg-background/80 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
