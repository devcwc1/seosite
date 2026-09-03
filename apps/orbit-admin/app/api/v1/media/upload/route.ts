import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { linkAssetToProduct, toAssetDTO } from "@/lib/media/assets";
import { MAX_UPLOAD_BYTES } from "@/lib/media/constants";
import { UploadError } from "@/lib/media/errors";
import { processUpload } from "@/lib/media/process";

export const runtime = "nodejs";

const log = createLogger({ route: "api/v1/media/upload" });
const INSTANCE = "/api/v1/media/upload";
const productIdSchema = z.string().uuid();

/** ORB-501 hardened upload: sniff → validate → re-encode → dedupe → store. */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return problemFor(401, "Sign in to upload media.", { instance: INSTANCE });
  }
  if (session.user.role === "viewer") {
    return problemFor(403, "Viewers cannot upload media.", {
      instance: INSTANCE,
    });
  }

  // Cheap early guard before buffering the body.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return problemFor(413, "Maximum upload size is 15 MB.", {
      instance: INSTANCE,
      extensions: { code: "too_large" },
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
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
