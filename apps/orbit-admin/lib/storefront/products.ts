import type { StorefrontProduct } from "@orbit/next";

import {
  mediaAssetsCollection,
  productsCollection,
  type ProductDoc,
} from "@/lib/db/mongo-collections";
import type { ProductImage } from "@/lib/db/schema";

import { assetUrlsById } from "./assets";
import { toStorefrontProduct, type StorefrontProductRow } from "./mapper";

/**
 * Read model behind the public storefront API. Products live in MongoDB with
 * their content, gallery and categories embedded; media asset URLs are
 * resolved from the media_assets collection.
 */

/** Resolve each product's ordered gallery to display images. */
async function galleriesByProduct(
  docs: ProductDoc[],
): Promise<Map<string, ProductImage[]>> {
  const map = new Map<string, ProductImage[]>();
  const assetIds = [
    ...new Set(docs.flatMap((d) => d.media.map((m) => m.mediaAssetId))),
  ];
  if (assetIds.length === 0) {
    for (const d of docs) map.set(d._id, []);
    return map;
  }

  const assetDocs = await mediaAssetsCollection()
    .find(
      { _id: { $in: assetIds } },
      { projection: { externalUrl: 1, alt: 1 } },
    )
    .toArray();
  const byId = new Map(assetDocs.map((a) => [a._id, a]));

  for (const d of docs) {
    const images: ProductImage[] = [...d.media]
      .sort((a, b) => a.position - b.position)
      .flatMap((m) => {
        const asset = byId.get(m.mediaAssetId);
        if (!asset) return [];
        const alt = m.alt ?? asset.alt;
        return [
          {
            url: asset.externalUrl ?? `/api/v1/media/file/${m.mediaAssetId}`,
            position: m.position,
            ...(alt ? { alt } : {}),
          },
        ];
      });
    map.set(d._id, images);
  }
  return map;
}

async function toRows(docs: ProductDoc[]): Promise<StorefrontProductRow[]> {
  const [galleries, ogImages] = await Promise.all([
    galleriesByProduct(docs),
    assetUrlsById(docs.map((d) => d.content.meta?.ogImageAssetId)),
  ]);

  return docs.map((d) => ({
    id: d._id,
    slug: d.slug,
    sku: d.sku,
    priceCents: d.priceCents,
    currency: d.currency,
    inStock: d.inStock,
    stockQuantity: d.stockQuantity,
    title: d.content.title,
    shortInfo: d.content.shortInfo,
    description: d.content.description,
    images: galleries.get(d._id) ?? [],
    categories: d.content.categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      isPrimary: c.isPrimary,
    })),
    meta: d.content.meta,
    ogImageUrl: d.content.meta?.ogImageAssetId
      ? (ogImages.get(d.content.meta.ogImageAssetId) ?? null)
      : null,
    updatedAt: d.updatedAt,
  }));
}

export async function listStorefrontProducts(): Promise<StorefrontProduct[]> {
  const docs = await productsCollection()
    .find({ status: "published" })
    .sort({ createdAt: 1 })
    .toArray();
  return (await toRows(docs)).map(toStorefrontProduct);
}

export async function getStorefrontProduct(
  slug: string,
): Promise<StorefrontProduct | null> {
  const doc = await productsCollection().findOne({ slug, status: "published" });
  if (!doc) return null;
  const [row] = await toRows([doc]);
  return row ? toStorefrontProduct(row) : null;
}
