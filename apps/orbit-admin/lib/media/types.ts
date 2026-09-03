/** ORB-501 hardened asset (content-addressed, deduped). */
export type MediaAssetDTO = {
  id: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  format: string;
  originalName: string | null;
  alt: string | null;
  createdAt: string;
};

/** A media asset as attached to a product's gallery. */
export type ProductMediaItemDTO = {
  assetId: string;
  url: string;
  alt: string | null;
  width: number;
  height: number;
  position: number;
};

