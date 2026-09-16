import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { listAssets } from "@/lib/media/assets";
import type { MediaUsageFilter } from "@/lib/media/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "api/v1/media" });

const USAGE_FILTERS: MediaUsageFilter[] = ["all", "used", "unused"];

function usageFilter(value: string | null): MediaUsageFilter {
  // An unrecognised value falls back to "all" rather than 422: this is a
  // listing, and a bad filter should not stop someone seeing their library.
  return USAGE_FILTERS.find((filter) => filter === value) ?? "all";
}

/** List media assets (for the library + picker). */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return problemFor(401, "Sign in required.", { instance: "/api/v1/media" });
  }

  try {
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit"));

    return NextResponse.json(
      await listAssets({
        query: params.get("q") ?? undefined,
        usage: usageFilter(params.get("usage")),
        cursor: params.get("cursor") ?? undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      }),
    );
  } catch (error) {
    log.error({ err: error, event: "media.list_failed" }, "List failed");
    return problemFor(500, "Failed to load media.", { instance: "/api/v1/media" });
  }
}
