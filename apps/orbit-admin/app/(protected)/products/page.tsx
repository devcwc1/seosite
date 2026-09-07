import { asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { mediaAssets, productContent, productMedia, products } from "@/lib/db/schema";
import { formatPrice } from "@/lib/format";

const STATUS_VARIANT = {
  published: "default",
  draft: "secondary",
  archived: "outline",
} as const;

type Thumb = { url: string; alt: string | null };

export default async function ProductsPage() {
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      status: products.status,
      priceCents: products.priceCents,
      currency: products.currency,
      inStock: products.inStock,
      stock: products.stockQuantity,
      title: productContent.title,
      // Legacy jsonb gallery — fallback for rows not yet backfilled.
      legacyImages: productContent.images,
    })
    .from(products)
    .leftJoin(productContent, eq(productContent.id, products.currentContentId))
    .orderBy(desc(products.createdAt));

  // Primary image per product from product_media (authoritative, ORB-501).
  const primaryByProduct = new Map<string, Thumb>();
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    const media = await db
      .select({
        productId: productMedia.productId,
        assetId: mediaAssets.id,
        externalUrl: mediaAssets.externalUrl,
        linkAlt: productMedia.alt,
        assetAlt: mediaAssets.alt,
        position: productMedia.position,
      })
      .from(productMedia)
      .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaAssetId))
      .where(inArray(productMedia.productId, ids))
      .orderBy(asc(productMedia.position));
    for (const m of media) {
      if (!primaryByProduct.has(m.productId)) {
        primaryByProduct.set(m.productId, {
          url: m.externalUrl ?? `/api/v1/media/file/${m.assetId}`,
          alt: m.linkAlt ?? m.assetAlt,
        });
      }
    }
  }

  function thumbFor(row: (typeof rows)[number]): Thumb | null {
    const primary = primaryByProduct.get(row.id);
    if (primary) return primary;
    const legacy = row.legacyImages
      ?.slice()
      .sort((a, b) => a.position - b.position)[0];
    return legacy ? { url: legacy.url, alt: legacy.alt ?? null } : null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "product" : "products"}
          </p>
        </div>
        <Link href="/products/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          New product
        </Link>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No products yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const thumb = thumbFor(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb.url}
                            alt={thumb.alt ?? row.title ?? ""}
                            className="size-9 rounded border bg-muted object-cover"
                          />
                        ) : (
                          <div className="size-9 rounded border bg-muted" />
                        )}
                        <Link
                          href={`/products/${row.id}`}
                          className="hover:underline"
                        >
                          {row.title ?? "—"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.sku}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(row.priceCents, row.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.inStock ? (
                        row.stock
                      ) : (
                        <span className="text-destructive">Out of stock</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/products/${row.id}`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          View
                        </Link>
                        <Link
                          href={`/products/${row.id}/edit`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          Edit
                        </Link>
                        <DeleteProductButton
                          id={row.id}
                          name={row.title ?? row.sku}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
