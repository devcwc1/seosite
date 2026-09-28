"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { MediaThumb } from "@/components/media/media-thumb";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { formatBytes } from "@/lib/format";
import type { MediaAssetDetailDTO, MediaUsageDTO } from "@/lib/media/types";

const USAGE_LABEL: Record<MediaUsageDTO["kind"], string> = {
  gallery: "Gallery",
  ogImage: "Share image",
  categoryOgImage: "Category share image",
  postCover: "Blog cover",
  postOgImage: "Blog share image",
  pageOgImage: "Page share image",
  siteDefaultOgImage: "Default share image",
  siteLogo: "Site logo",
};

/**
 * The detail drawer — ORB-505, doc 15 screen 31.
 *
 * Usage is the reason this exists. Everything else here is metadata someone
 * might glance at; the list of products using an asset is what makes it
 * possible to decide whether changing or deleting it is safe.
 */
export function MediaDetailDrawer({
  assetId,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  /** Null closes the drawer. */
  assetId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (asset: MediaAssetDetailDTO) => void;
  onDelete: (asset: MediaAssetDetailDTO) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [asset, setAsset] = useState<MediaAssetDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assetId) return;

    // Usage can change while the library sits open, so it is fetched when the
    // drawer opens rather than carried over from the grid's listing.
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAsset(null);

    fetch(`/api/v1/media/${assetId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load asset details");
        return (await res.json()) as MediaAssetDetailDTO;
      })
      .then((data) => {
        if (!cancelled) setAsset(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const name = asset?.title ?? asset?.originalName ?? "Image";

  return (
    <Sheet open={assetId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[28rem]">
        <SheetHeader>
          <SheetTitle className="truncate">{name}</SheetTitle>
          <SheetDescription>
            {asset ? asset.originalName : "Asset details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {loading ? (
            <p className="text-muted-foreground text-body">Loading…</p>
          ) : null}
          {error ? <p className="text-status-danger-foreground text-body">{error}</p> : null}

          {asset ? (
            <>
              <MediaThumb
                src={asset.url}
                alt={asset.alt ?? name}
                className="max-h-64 w-full rounded-lg border object-contain"
              />

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
                <Detail label="Dimensions">
                  {asset.width}×{asset.height}
                </Detail>
                <Detail label="Size">{formatBytes(asset.sizeBytes)}</Detail>
                <Detail label="Format">{asset.format.toUpperCase()}</Detail>
                <Detail label="Original">
                  {/* Everything is re-encoded to webp on upload (ORB-501), so
                      the original type is the only record of what came in. */}
                  {asset.originalMimeType ?? "—"}
                </Detail>
                <Detail label="Uploaded by">
                  {asset.uploadedByEmail ?? "—"}
                </Detail>
                <Detail label="Added">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </Detail>
              </dl>

              {asset.alt ? (
                <div>
                  <p className="text-caption text-muted-foreground">Alt text</p>
                  <p className="text-body">{asset.alt}</p>
                </div>
              ) : null}

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-section-title">Used by</h3>
                  <StatusChip
                    domain="mediaUsage"
                    value={asset.usage.length > 0 ? "inUse" : "unused"}
                  />
                </div>

                {asset.usage.length === 0 ? (
                  <p className="text-muted-foreground text-body">
                    Nothing uses this image. It can be deleted safely.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {asset.usage.map((use) => (
                      <li
                        key={`${use.targetId}-${use.kind}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <Link href={use.href} className="text-body hover:underline">
                          {use.title}
                        </Link>
                        <span className="text-caption text-muted-foreground shrink-0">
                          {USAGE_LABEL[use.kind]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {canEdit || canDelete ? (
                <div className="flex gap-2 border-t pt-4">
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(asset)}
                    >
                      Edit details
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      // An in-use asset cannot be deleted — the server refuses
                      // it, so the control says so rather than inviting the
                      // click and answering with an error.
                      disabled={asset.usage.length > 0}
                      title={
                        asset.usage.length > 0
                          ? "Remove it from every product first"
                          : undefined
                      }
                      onClick={() => onDelete(asset)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}
