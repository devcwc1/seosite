import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Max upload size (bytes). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

/**
 * Where uploaded files live. Defaults to `<cwd>/uploads`; in Docker set
 * UPLOAD_DIR to a mounted volume so uploads survive container restarts.
 */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}

export function isAllowedImageType(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

/** Persist an uploaded file and return its served URL. */
export async function saveUpload(file: File): Promise<{ url: string; name: string }> {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type}`);

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });

  const name = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), bytes);

  return { url: `/api/uploads/${name}`, name };
}

/** Content-type for a stored filename, or null if the extension isn't allowed. */
export function contentTypeForName(name: string): string | null {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? null;
}
