import type { MediaAssetDTO } from "@/lib/media/types";

export type UploadResult = { asset: MediaAssetDTO; alreadyInLibrary: boolean };

/**
 * Upload one file to the hardened endpoint with progress. Uses XHR (not fetch)
 * because only XHR exposes upload progress events.
 */
export function uploadMedia(
  file: File,
  opts: { productId?: string; onProgress?: (percent: number) => void } = {},
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/media/upload");
    xhr.responseType = "json";

    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as UploadResult);
      } else {
        const body = xhr.response as { detail?: string; title?: string } | null;
        reject(
          new Error(body?.detail ?? body?.title ?? `Upload failed (${xhr.status})`),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    const form = new FormData();
    form.append("file", file);
    if (opts.productId) form.append("productId", opts.productId);
    xhr.send(form);
  });
}

export const ACCEPTED_IMAGE_TYPES =
  "image/png,image/jpeg,image/webp,image/avif";
