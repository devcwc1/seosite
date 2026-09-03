import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { listAssets } from "@/lib/media/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "api/v1/media" });

/** List media assets (for the library + picker). */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return problemFor(401, "Sign in required.", { instance: "/api/v1/media" });
  }

  try {
    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    return NextResponse.json(await listAssets(q));
  } catch (error) {
    log.error({ err: error, event: "media.list_failed" }, "List failed");
    return problemFor(500, "Failed to load media.", { instance: "/api/v1/media" });
  }
}
