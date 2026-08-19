import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { createMediaFromFile, listMedia } from "@/lib/media/mutations";
import { isAllowedImageType, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "api/media" });
const INSTANCE = "/api/media";

/** List media (optionally `?q=` filtered). */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) return problemFor(401, "Sign in required.", { instance: INSTANCE });

  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json(await listMedia(q));
  } catch (error) {
    log.error({ err: error, event: "media.list_failed" }, "List failed");
    return problemFor(500, "Failed to load media.", { instance: INSTANCE });
  }
}

/** Upload an image (multipart field `file`) into the media library. */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) return problemFor(401, "Sign in to upload files.", { instance: INSTANCE });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return problemFor(400, "Request body must be multipart form data.", {
      instance: INSTANCE,
    });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return problemFor(400, "Expected a file in the 'file' field.", {
      instance: INSTANCE,
    });
  }
  if (!isAllowedImageType(file.type)) {
    return problemFor(415, "Use PNG, JPEG, WebP, GIF or AVIF.", {
      instance: INSTANCE,
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return problemFor(413, "Maximum upload size is 5 MB.", {
      instance: INSTANCE,
      extensions: { maxBytes: MAX_UPLOAD_BYTES },
    });
  }

  try {
    const asset = await createMediaFromFile(file, session.user.id);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    log.error({ err: error, event: "media.upload_failed" }, "Upload failed");
    return problemFor(500, "The file could not be stored.", {
      instance: INSTANCE,
    });
  }
}
