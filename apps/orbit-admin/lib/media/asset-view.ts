import type { MediaAssetDoc } from "@/lib/db/mongo-collections";

/**
 * A media asset in the shape the app has always used (`id`, not `_id`), so the
 * URL helpers, DTOs and the upload result stay stable while the store moves to
 * MongoDB.
 */
export type MediaAssetView = {
  id: string;
  sha256: string;
  storageKey: string | null;
  externalUrl: string | null;
  thumbKey: string | null;
  format: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalName: string | null;
  originalMimeType: string | null;
  title: string | null;
  alt: string | null;
  deletedAt: Date | null;
  uploadedBy: string | null;
  createdAt: Date;
};

export function docToAssetView(doc: MediaAssetDoc): MediaAssetView {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}
