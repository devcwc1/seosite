import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { contentTypeForName, uploadDir } from "@/lib/uploads";

export const runtime = "nodejs";

/** Serve a stored upload by filename. Public — images are not secret. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<NextResponse> {
  const { name } = await params;
  const instance = `/api/uploads/${name}`;

  // Only allow simple filenames — never path traversal.
  if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.includes("..")) {
    return problemFor(400, "Invalid file name.", { instance });
  }

  const type = contentTypeForName(name);
  if (!type) {
    return problemFor(404, "No such file.", { instance });
  }

  try {
    const data = await readFile(path.join(uploadDir(), name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return problemFor(404, "No such file.", { instance });
  }
}
