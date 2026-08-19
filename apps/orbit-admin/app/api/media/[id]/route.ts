import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { deleteMedia } from "@/lib/media/mutations";

export const runtime = "nodejs";

const log = createLogger({ route: "api/media/[id]" });

/** Delete a media asset (DB row + file on disk). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getCurrentSession();
  const { id } = await params;
  const instance = `/api/media/${id}`;

  if (!session) return problemFor(401, "Sign in required.", { instance });

  try {
    const result = await deleteMedia(id, session.user.id);
    if (!result.ok) return problemFor(404, "No such media.", { instance });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ err: error, id, event: "media.delete_failed" }, "Delete failed");
    return problemFor(500, "Failed to delete media.", { instance });
  }
}
