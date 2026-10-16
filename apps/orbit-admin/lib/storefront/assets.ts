import { mediaAssetsCollection } from "@/lib/db/mongo-collections";
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

  const docs = await mediaAssetsCollection()
    .find(
      { _id: { $in: wanted }, deletedAt: null },
      { projection: { externalUrl: 1 } },
    )
    .toArray();

  for (const doc of docs) {
    urls.set(doc._id, assetUrl({ id: doc._id, externalUrl: doc.externalUrl }));
  }
  return urls;
}
