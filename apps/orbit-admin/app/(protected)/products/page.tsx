import { desc, eq } from "drizzle-orm";
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
import { productContent, products } from "@/lib/db/schema";
import { formatPrice } from "@/lib/format";

const STATUS_VARIANT = {
  published: "default",
  draft: "secondary",
  archived: "outline",
} as const;

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
      images: productContent.images,
    })
    .from(products)
    .leftJoin(productContent, eq(productContent.id, products.currentContentId))
    .orderBy(desc(products.createdAt));

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
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const img = row.images
                          ?.slice()
                          .sort((a, b) => a.position - b.position)[0];
                        return img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.url}
                            alt={img.alt ?? row.title ?? ""}
                            className="size-9 rounded border bg-muted object-cover"
                          />
                        ) : (
                          <div className="size-9 rounded border bg-muted" />
                        );
                      })()}
                      <span>{row.title ?? "—"}</span>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
