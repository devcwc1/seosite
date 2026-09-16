"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * An asset's image, with a placeholder when the file will not load.
 *
 * Files live on a mounted volume, and a volume can be remounted, restored
 * from a backup taken at a different moment, or simply not be there in a
 * fresh environment. A broken image icon in a grid of eighty makes the whole
 * library look broken; a labelled placeholder says which asset is missing.
 */
export function MediaThumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt — the same component instance is
  // reused as the grid re-renders, and a previous failure must not stick to
  // whatever asset lands in that slot next.
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt ? `${alt} (image unavailable)` : "Image unavailable"}
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center",
          className,
        )}
      >
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  }

  return (
    /* Asset URLs are served by our own route or are external backfills, so
       next/image's allow-list does not apply. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("bg-muted", className)}
    />
  );
}
