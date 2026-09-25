import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { listStorefrontPosts } from "@/lib/storefront/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/posts" });

/** Published blog posts, consumed by the storefront via `@orbit/next`. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await listStorefrontPosts());
  } catch (error) {
    log.error({ err: error, event: "storefront.posts_failed" }, "Posts list failed");
    return problemFor(500, "Failed to load posts.", { instance: "/api/storefront/posts" });
  }
}
