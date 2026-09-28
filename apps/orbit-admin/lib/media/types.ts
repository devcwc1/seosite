/** ORB-501 hardened asset (content-addressed, deduped). */
export type MediaAssetDTO = {
  id: string;
  url: string;
  /**
   * Grid-sized copy. Falls back to the full-size URL for assets that have no
   * thumbnail, so a caller can always just use it.
   */
  thumbUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  format: string;
  originalName: string | null;
  title: string | null;
  alt: string | null;
  createdAt: string;
  /**
   * How many products reference this asset, gallery and OG together. Lets the
   * grid show used/unused without a query per cell.
   */
  usageCount: number;
};

/** One thing that references an asset, for the detail drawer. */
export type MediaUsageDTO = {
  kind:
    | "gallery"
    | "ogImage"
    | "categoryOgImage"
    | "postCover"
    | "postOgImage"
    | "pageOgImage"
    | "siteDefaultOgImage"
    | "siteLogo";
  /** Product or category id; the settings key for site-wide uses. */
  targetId: string;
  title: string;
  /** Where in the admin to change it. */
  href: string;
};

/** One asset plus everything the detail drawer shows. */
export type MediaAssetDetailDTO = MediaAssetDTO & {
  /** What was uploaded, before the re-encode to webp. */
  originalMimeType: string | null;
  uploadedByEmail: string | null;
  usage: MediaUsageDTO[];
};

/** A page of the library. */
export type MediaListDTO = {
  items: MediaAssetDTO[];
  /** Pass back as `cursor` for the next page; null when this is the last. */
  nextCursor: string | null;
  /** Total matching the current filters, before paging. */
  total: number;
};

/** What the library and picker may ask for. */
export type MediaUsageFilter = "all" | "used" | "unused";

/** A media asset as attached to a product's gallery. */
export type ProductMediaItemDTO = {
  assetId: string;
  url: string;
  alt: string | null;
  width: number;
  height: number;
  position: number;
};

