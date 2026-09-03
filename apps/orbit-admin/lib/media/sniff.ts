import type { AllowedFormat } from "./constants";

export type SniffResult = AllowedFormat | "svg" | "unknown";

/**
 * Detect an image format from its leading bytes (magic numbers). Deliberately
 * conservative: only the raster allowlist is recognized, SVG is flagged for
 * explicit rejection, and everything else is "unknown".
 */
export function sniffImageFormat(bytes: Uint8Array): SniffResult {
  const at = (i: number): number => bytes[i] ?? -1;
  if (bytes.length < 12) return "unknown";

  // JPEG: FF D8 FF
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return "png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return "webp";
  }

  // AVIF: box "ftyp" at bytes 4-7 with brand "avif"/"avis" at 8-11
  if (at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11));
    if (brand === "avif" || brand === "avis") return "avif";
  }

  // SVG / XML text — flag for explicit rejection.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg") || head.includes("<svg")) {
    return "svg";
  }

  return "unknown";
}
