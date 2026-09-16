import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Root of the media volume. Deliberately separate from the app and from any
 * executable path (FR-SEC-004): originals never live where they could be
 * served as code. In Docker this is a mounted volume (MEDIA_DIR).
 */
export function mediaRoot(): string {
  return process.env.MEDIA_DIR ?? path.join(process.cwd(), "media");
}

/** Content-addressed key: shard by sha256 prefix, uuid filename. */
export function buildStorageKey(sha256: string): string {
  const a = sha256.slice(0, 2);
  const b = sha256.slice(2, 4);
  return `products/${a}/${b}/${randomUUID()}.webp`;
}

/** The thumbnail's key, derived from the original's so they stay together. */
export function buildThumbKey(storageKey: string): string {
  return storageKey.replace(/.webp$/, ".thumb.webp");
}

/** Reject any key that could escape the media root. */
function resolveWithinRoot(storageKey: string): string {
  const root = mediaRoot();
  const full = path.resolve(root, storageKey);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Resolved media path escapes the media root");
  }
  return full;
}

/** Write via a temp file then atomically rename into place. */
export async function writeAtomic(
  storageKey: string,
  data: Uint8Array,
): Promise<void> {
  const full = resolveWithinRoot(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.${randomUUID()}.tmp`;
  await writeFile(tmp, data);
  try {
    await rename(tmp, full);
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    throw error;
  }
}

export async function deleteStored(storageKey: string): Promise<void> {
  await unlink(resolveWithinRoot(storageKey)).catch(() => undefined);
}

export async function readStored(storageKey: string): Promise<Buffer> {
  return readFile(resolveWithinRoot(storageKey));
}
