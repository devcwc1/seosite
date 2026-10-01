import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { getStorefrontPage } from "@/lib/storefront/pages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/pages/[slug]" });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const instance = `/api/storefront/pages/${slug}`;
  try {
    const page = await getStorefrontPage(slug);
    if (!page) return problemFor(404, "No such page.", { instance });
    return NextResponse.json(page);
  } catch (error) {
    log.error({ err: error, slug, event: "storefront.page_failed" }, "Page fetch failed");
    return problemFor(500, "Failed to load the page.", { instance });
  }
}
