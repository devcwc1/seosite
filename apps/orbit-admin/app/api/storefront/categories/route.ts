import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { listStorefrontCategories } from "@/lib/storefront/categories";

// Reads live category content; `@orbit/next` owns caching on the consumer side.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/categories" });

/** Public category feed — one archive page per entry. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await listStorefrontCategories());
  } catch (error) {
    log.error({ err: error, event: "categories.list_failed" }, "List failed");
    return problemFor(500, "Failed to load categories.", {
      instance: "/api/storefront/categories",
    });
  }
}
