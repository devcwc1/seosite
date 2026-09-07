import "server-only";

import { UploadError } from "./errors";

/**
 * Drain a web ReadableStream into a Buffer, aborting the moment the running
 * total exceeds `cap`. This bounds memory and rejects oversized uploads even
 * when the client omits or spoofs Content-Length (e.g. chunked transfer),
 * which a header-only guard cannot catch. The image must be fully in memory
 * for sniffing/hashing/re-encoding anyway, so we stream only to enforce the
 * cap early — never holding more than `cap` bytes.
 */
export async function readCappedStream(
  body: ReadableStream<Uint8Array>,
  cap: number,
): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => undefined);
      throw new UploadError("too_large", "Maximum upload size is 15 MB.", 413);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
