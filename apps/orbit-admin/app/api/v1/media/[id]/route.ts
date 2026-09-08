import { NextResponse } from "next/server";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { deleteAsset, updateAsset } from "@/lib/media/assets";

export const runtime = "nodejs";

const log = createLogger({ route: "api/v1/media/[id]" });

const MAX_FIELD = 512;

function normalizeField(
  value: unknown,
  instance: string,
): { value: string | null } | { error: NextResponse } {
  if (value === null) return { value: null };
  if (typeof value !== "string") {
    return { error: problemFor(422, "Field must be a string or null.", { instance }) };
  }
  if (value.length > MAX_FIELD) {
    return {
      error: problemFor(422, `Field must be at most ${MAX_FIELD} characters.`, {
        instance,
      }),
    };
  }
  return { value };
}

/** Update editable metadata (title, alt) of a media asset. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getCurrentSession();
  const { id } = await params;
  const instance = `/api/v1/media/${id}`;

  if (!session) return problemFor(401, "Sign in required.", { instance });
  if (!isWriter(session.user)) {
    return problemFor(403, "Viewers cannot edit media.", { instance });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemFor(400, "Invalid JSON body.", { instance });
  }
  if (typeof body !== "object" || body === null) {
    return problemFor(422, "Expected an object body.", { instance });
  }

  const patch: { title?: string | null; alt?: string | null } = {};
  const raw = body as Record<string, unknown>;
  if ("title" in raw) {
    const r = normalizeField(raw.title, instance);
    if ("error" in r) return r.error;
    patch.title = r.value;
  }
  if ("alt" in raw) {
    const r = normalizeField(raw.alt, instance);
    if ("error" in r) return r.error;
    patch.alt = r.value;
  }

  try {
    const result = await updateAsset(id, patch, session.user.id);
    if (!result.ok) {
      return problemFor(404, result.error, { instance });
    }
    return NextResponse.json(result.asset);
  } catch (error) {
    log.error({ err: error, id, event: "media.update_failed" }, "Update failed");
    return problemFor(500, "Failed to update media.", { instance });
  }
}

/** Delete a media asset. Blocked (409) while linked to any product. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getCurrentSession();
  const { id } = await params;
  const instance = `/api/v1/media/${id}`;

  if (!session) return problemFor(401, "Sign in required.", { instance });
  if (!isWriter(session.user)) {
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
