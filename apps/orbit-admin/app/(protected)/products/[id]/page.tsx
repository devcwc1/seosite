import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductGalleryManager } from "@/components/products/product-gallery-manager";
import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { getProductForEdit } from "@/lib/products/mutations";
import { formatPrice } from "@/lib/format";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, session] = await Promise.all([
    getProductForEdit(id),
    getCurrentSession(),
  ]);
  if (!product) notFound();

  const canWrite = !!session && isWriter(session.user);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.title || "Untitled product"}
            </h1>
            <StatusChip domain="product" value={product.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {product.sku} · {product.slug}
          </p>
        </div>
        {canWrite ? (
          <Link
            href={`/products/${product.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil className="size-4" aria-hidden />
            Edit
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="tabular-nums">
              {formatPrice(Math.round(product.price * 100), product.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stock</p>
            <p className="tabular-nums">
              {product.inStock ? (
                `${product.stockQuantity} in stock`
              ) : (
                <span className="text-destructive">Out of stock</span>
              )}
            </p>
          </div>
          {product.shortInfo ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Short description</p>
              <p>{product.shortInfo}</p>
            </div>
          ) : null}
          {product.description ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap">{product.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
          <CardDescription>
            {product.images.length}{" "}
            {product.images.length === 1 ? "image" : "images"} attached to this
            product.{canWrite ? " Uploads here are attached automatically." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductGalleryManager
            productId={product.id}
            images={product.images}
            canWrite={canWrite}
          />
        </CardContent>
      </Card>
    </div>
  );
}
