import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { getStorefrontCategory } from "@/lib/storefront/categories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/categories/[slug]" });

/**
 * One category by slug. The 404 here is the contract `@orbit/next` maps to
 * `null`, the same as for products.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const instance = `/api/storefront/categories/${slug}`;

  try {
    const category = await getStorefrontCategory(slug);
    if (!category) return problemFor(404, "No such category.", { instance });

    return NextResponse.json(category);
  } catch (error) {
    log.error({ err: error, event: "categories.get_failed" }, "Get failed");
    return problemFor(500, "Failed to load the category.", { instance });
  }
}
