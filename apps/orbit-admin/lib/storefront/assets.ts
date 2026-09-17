import { and, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { assetUrl } from "@/lib/media/assets";

/**
 * Served URLs for a set of asset ids, in one query.
 *
 * Soft-deleted assets resolve to nothing: an image removed from the library
 * must stop appearing in share cards, not linger because a meta field still
 * holds its id.
 */
export async function assetUrlsById(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const urls = new Map<string, string>();
  if (wanted.length === 0) return urls;

  const rows = await db
    .select({ id: mediaAssets.id, externalUrl: mediaAssets.externalUrl })
    .from(mediaAssets)
    .where(and(inArray(mediaAssets.id, wanted), isNull(mediaAssets.deletedAt)));

  for (const row of rows) urls.set(row.id, assetUrl(row));
  return urls;
}
