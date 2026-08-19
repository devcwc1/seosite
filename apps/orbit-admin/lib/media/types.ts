/** Wire shape for a media asset (safe to import from client components). */
export type MediaDTO = {
  id: string;
  /** Served URL, e.g. /api/uploads/<filename>. */
  url: string;
  filename: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: string;
};
