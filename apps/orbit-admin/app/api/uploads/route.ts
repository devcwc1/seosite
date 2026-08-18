import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { isAllowedImageType, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/uploads";

export const runtime = "nodejs";

const log = createLogger({ route: "api/uploads" });
const INSTANCE = "/api/uploads";

/** Accept a single image file (multipart form field `file`) and store it. */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return problemFor(401, "Sign in to upload files.", { instance: INSTANCE });
  }

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
    const saved = await saveUpload(file);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    log.error({ err: error, event: "upload.failed" }, "Upload failed");
    return problemFor(500, "The file could not be stored.", {
      instance: INSTANCE,
    });
  }
}
