import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { linkAssetToProduct, toAssetDTO } from "@/lib/media/assets";
import { MAX_UPLOAD_BYTES } from "@/lib/media/constants";
import { UploadError } from "@/lib/media/errors";
import { processUpload } from "@/lib/media/process";
import { readCappedStream } from "@/lib/media/stream";

export const runtime = "nodejs";

const log = createLogger({ route: "api/v1/media/upload" });
const INSTANCE = "/api/v1/media/upload";
const productIdSchema = z.string().uuid();
/** Hard body cap: the 15 MB image plus room for multipart field overhead. */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;

/** ORB-501 hardened upload: sniff → validate → re-encode → dedupe → store. */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return problemFor(401, "Sign in to upload media.", { instance: INSTANCE });
  }
  if (!isWriter(session.user)) {
    return problemFor(403, "Viewers cannot upload media.", {
      instance: INSTANCE,
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return problemFor(415, "Expected multipart/form-data.", {
      instance: INSTANCE,
    });
  }

  // Cheap early guard for honest clients that declare an oversized body.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return problemFor(413, "Maximum upload size is 15 MB.", {
      instance: INSTANCE,
      extensions: { code: "too_large" },
    });
  }

  if (!request.body) {
    return problemFor(400, "Empty request body.", { instance: INSTANCE });
  }

  // Stream the body with a hard cap so a spoofed/absent Content-Length (e.g.
  // chunked transfer) can't force unbounded buffering, then parse the multipart
  // from the capped buffer.
  let form: FormData;
  try {
    const buffered = await readCappedStream(request.body, MAX_BODY_BYTES);
    form = await new Response(new Uint8Array(buffered), {
      headers: { "content-type": contentType },
    }).formData();
  } catch (error) {
    if (error instanceof UploadError) {
      return problemFor(error.status, error.message, {
        instance: INSTANCE,
        extensions: { code: error.code },
      });
    }
    return problemFor(400, "Expected multipart form data.", {
      instance: INSTANCE,
    });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return problemFor(400, "Expected a file in the 'file' field.", {
      instance: INSTANCE,
    });
  }

  const rawProductId = form.get("productId");
  let productId: string | undefined;
  if (rawProductId !== null && String(rawProductId) !== "") {
    const parsed = productIdSchema.safeParse(String(rawProductId));
    if (!parsed.success) {
      return problemFor(400, "Invalid productId.", { instance: INSTANCE });
    }
    productId = parsed.data;
  }

  try {
    const { asset, alreadyInLibrary } = await processUpload(
      file,
      session.user.id,
    );

    if (productId) {
      try {
        await linkAssetToProduct(productId, asset.id);
      } catch (linkError) {
        // The asset is valid; only the association failed. Don't fail upload.
        log.warn(
          { err: linkError, productId, assetId: asset.id },
          "Failed to auto-associate asset with product",
        );
      }
    }

    return NextResponse.json(
      { asset: toAssetDTO(asset), alreadyInLibrary },
      { status: alreadyInLibrary ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof UploadError) {
      return problemFor(error.status, error.message, {
        instance: INSTANCE,
        extensions: { code: error.code },
      });
    }
    log.error({ err: error, event: "media.upload_failed" }, "Upload failed");
    return problemFor(500, "Upload failed.", { instance: INSTANCE });
  }
}
