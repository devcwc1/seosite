import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { listStorefrontProducts } from "@/lib/storefront/products";

// Reads live product data; `@orbit/next` owns caching on the consumer side.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/products" });

/** Public product feed consumed by the storefront via `@orbit/next`. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await listStorefrontProducts());
  } catch (error) {
    log.error({ err: error, event: "storefront.list_failed" }, "List failed");

    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}
