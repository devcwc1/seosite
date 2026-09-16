/**
 * Report — and optionally remove — files on the media volume that no
 * media_assets row points at.
 *
 *   npx tsx scripts/sweep-media.ts          # list them, change nothing
 *   npx tsx scripts/sweep-media.ts --delete # remove them
 *
 * Orphans are expected, not a bug. Deletion is soft by design (ORB-505), so
 * a deleted asset keeps its file; an interrupted upload can leave one behind;
 * and a test suite that cleans up its rows may not clean up its bytes.
 * Reclaiming the space is a deliberate act, which is why this is a script an
 * operator runs and not something the app does on its own.
 *
 * Soft-deleted assets are NOT orphans: their row still points at the file,
 * and re-uploading the same bytes restores them. This only removes files
 * nothing references at all.
 */
import "dotenv/config";

import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { isNotNull } from "drizzle-orm";

import { db, pool } from "../lib/db";
import { mediaAssets } from "../lib/db/schema";

/**
 * Deliberately not imported from lib/media/storage: that module is marked
 * "server-only", which a plain tsx script cannot resolve. One line duplicated
 * beats making the app's storage module runnable outside the app.
 */
function mediaRoot(): string {
  return process.env.MEDIA_DIR ?? path.join(process.cwd(), "media");
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

async function main() {
  const remove = process.argv.includes("--delete");
  const root = mediaRoot();

  const rows = await db
    .select({ storageKey: mediaAssets.storageKey, thumbKey: mediaAssets.thumbKey })
    .from(mediaAssets)
    .where(isNotNull(mediaAssets.storageKey));

  // Every key any row points at, soft-deleted rows included.
  const referenced = new Set<string>();
  for (const row of rows) {
    if (row.storageKey) referenced.add(path.resolve(root, row.storageKey));
    if (row.thumbKey) referenced.add(path.resolve(root, row.thumbKey));
  }

  const onDisk = await walk(root);
  const orphans = onDisk.filter((file) => !referenced.has(path.resolve(file)));

  if (orphans.length === 0) {
    console.log(`No orphans. ${onDisk.length} files, all referenced.`);
    return;
  }

  let bytes = 0;
  for (const file of orphans) {
    const info = await stat(file).catch(() => null);
    if (info) bytes += info.size;
    console.log(`${remove ? "removing" : "orphan  "}  ${path.relative(root, file)}`);
    if (remove) await unlink(file).catch(() => {});
  }

  const mb = (bytes / 1024 / 1024).toFixed(2);
  console.log(
    remove
      ? `\nRemoved ${orphans.length} file(s), ${mb} MB.`
      : `\n${orphans.length} orphan(s), ${mb} MB. Re-run with --delete to remove.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
