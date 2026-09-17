import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { getStorefrontSite } from "@/lib/storefront/site";

// Reads live settings; `@orbit/next` owns caching on the consumer side.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/site" });

/** Site-wide search and social settings, consumed via `@orbit/next`. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getStorefrontSite());
  } catch (error) {
    log.error({ err: error, event: "storefront.site_failed" }, "Site settings failed");
    return problemFor(500, "Failed to load site settings.", {
      instance: "/api/storefront/site",
    });
  }
}
