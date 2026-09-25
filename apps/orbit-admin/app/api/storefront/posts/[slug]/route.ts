import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { getStorefrontPost } from "@/lib/storefront/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger({ route: "api/storefront/posts/[slug]" });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const instance = `/api/storefront/posts/${slug}`;
  try {
    const post = await getStorefrontPost(slug);
    if (!post) return problemFor(404, "No such post.", { instance });
    return NextResponse.json(post);
  } catch (error) {
    log.error({ err: error, slug, event: "storefront.post_failed" }, "Post fetch failed");
    return problemFor(500, "Failed to load the post.", { instance });
  }
}
