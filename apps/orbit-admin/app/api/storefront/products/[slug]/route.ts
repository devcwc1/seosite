import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { getStorefrontProduct } from "@/lib/storefront/products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/products/[slug]" });

/**
 * Single published product by slug. The 404 here is the contract `@orbit/next`
 * relies on to resolve `getProduct()` to `null`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const instance = `/api/storefront/products/${slug}`;

  try {
    const product = await getStorefrontProduct(slug);

    if (!product) {
      return problemFor(404, "No published product with that slug.", {
        instance,
      });
    }

    return NextResponse.json(product);
  } catch (error) {
    log.error(
      { err: error, slug, event: "storefront.get_failed" },
      "Product lookup failed",
    );

    return problemFor(500, "Failed to load product.", { instance });
  }
}
