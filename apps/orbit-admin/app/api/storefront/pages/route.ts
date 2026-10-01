import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { listStorefrontPages } from "@/lib/storefront/pages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/pages" });

/** Published content pages, consumed by the storefront via `@orbit/next`. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await listStorefrontPages());
  } catch (error) {
    log.error({ err: error, event: "storefront.pages_failed" }, "Pages list failed");
    return problemFor(500, "Failed to load pages.", { instance: "/api/storefront/pages" });
  }
}
