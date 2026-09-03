import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { deleteAsset } from "@/lib/media/assets";

export const runtime = "nodejs";

const log = createLogger({ route: "api/v1/media/[id]" });

/** Delete a media asset. Blocked (409) while linked to any product. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getCurrentSession();
  const { id } = await params;
  const instance = `/api/v1/media/${id}`;

  if (!session) return problemFor(401, "Sign in required.", { instance });
  if (session.user.role === "viewer") {
    return problemFor(403, "Viewers cannot delete media.", { instance });
  }

  try {
    const result = await deleteAsset(id, session.user.id);
    if (!result.ok) {
      // "in use" is a conflict; "not found" is a 404.
      const status = result.error?.includes("used") ? 409 : 404;
      return problemFor(status, result.error ?? "Delete failed.", { instance });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ err: error, id, event: "media.delete_failed" }, "Delete failed");
    return problemFor(500, "Failed to delete media.", { instance });
  }
}
