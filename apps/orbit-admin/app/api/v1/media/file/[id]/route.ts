import { NextResponse } from "next/server";

import { mediaAssetsCollection } from "@/lib/db/mongo-collections";
import { problemFor } from "@/lib/http/problem";
import { readStored } from "@/lib/media/storage";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serve a stored asset by id. Content is immutable + content-addressed, so it
 * caches forever; `nosniff` keeps the browser from re-interpreting the bytes.
 * (Eventual ORB-103: serve straight from the volume via Caddy.)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const instance = `/api/v1/media/file/${id}`;

  if (!UUID_RE.test(id)) {
    return problemFor(400, "Invalid asset id.", { instance });
  }

  const asset = await mediaAssetsCollection().findOne({ _id: id });
  if (!asset) return problemFor(404, "No such asset.", { instance });

  if (asset.externalUrl) {
    return NextResponse.redirect(asset.externalUrl, 302);
  }
  if (!asset.storageKey) {
    return problemFor(404, "No stored file for this asset.", { instance });
  }

  // `?variant=thumb` asks for the grid-sized copy. Assets uploaded before
  // thumbnails existed have none, and rather than 404 or backfill on read,
  // the original is served — correct, just larger.
  const wantsThumb =
    new URL(request.url).searchParams.get("variant") === "thumb";
  const key = wantsThumb && asset.thumbKey ? asset.thumbKey : asset.storageKey;

  try {
    const data = await readStored(key);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return problemFor(404, "Stored file missing.", { instance });
  }
}
