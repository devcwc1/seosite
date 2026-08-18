import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { isAllowedImageType, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/uploads";

export const runtime = "nodejs";

const log = createLogger({ route: "api/uploads" });

/** Accept a single image file (multipart form field `file`) and store it. */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!isAllowedImageType(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPEG, WebP, GIF or AVIF." },
      { status: 415 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)." },
      { status: 413 },
    );
  }

  try {
    const saved = await saveUpload(file);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    log.error({ err: error, event: "upload.failed" }, "Upload failed");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
