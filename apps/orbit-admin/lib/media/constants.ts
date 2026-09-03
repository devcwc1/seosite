// ORB-501 intake policy — allowlist and bounds as code constants (FR-SEC-004).

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 8000;

/** Decompression-bomb guard passed to sharp's `limitInputPixels`. */
export const MAX_INPUT_PIXELS = MAX_DIMENSION * MAX_DIMENSION;

/** Raster-only allowlist. SVG is intentionally excluded (XSS vector). */
export const ALLOWED_FORMATS = ["jpeg", "png", "webp", "avif"] as const;
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

export const ALLOWED_MIME_TYPES: Record<AllowedFormat, readonly string[]> = {
  jpeg: ["image/jpeg", "image/jpg"],
  png: ["image/png"],
  webp: ["image/webp"],
  avif: ["image/avif"],
};

export const ALLOWED_EXTENSIONS: Record<AllowedFormat, readonly string[]> = {
  jpeg: [".jpg", ".jpeg"],
  png: [".png"],
  webp: [".webp"],
  avif: [".avif"],
};

// Everything is neutralized to WebP on the way in.
export const OUTPUT_FORMAT = "webp";
export const OUTPUT_MIME = "image/webp";
export const WEBP_QUALITY = 82;
