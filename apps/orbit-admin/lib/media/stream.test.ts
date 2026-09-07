import { describe, expect, it } from "vitest";

import { UploadError } from "@/lib/media/errors";
import { readCappedStream } from "@/lib/media/stream";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("readCappedStream", () => {
  it("returns the full body when it stays under the cap", async () => {
    const buf = await readCappedStream(
      streamOf([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
      10,
    );
    expect([...buf]).toEqual([1, 2, 3, 4, 5]);
  });

  it("throws too_large as soon as the cap is exceeded", async () => {
    const chunk = new Uint8Array(1024);
    await expect(
      readCappedStream(streamOf([chunk, chunk, chunk]), 2048),
    ).rejects.toMatchObject({ code: "too_large", status: 413 });
  });

  it("rejects with a typed UploadError", async () => {
    const chunk = new Uint8Array(4096);
    await expect(
      readCappedStream(streamOf([chunk]), 1024),
    ).rejects.toBeInstanceOf(UploadError);
  });

  it("round-trips a real multipart body the way the route parses it", async () => {
    // Build a genuine multipart/form-data body via the platform, exactly like a
    // browser upload, then replay the route's parse: stream → cap → formData.
    const fileBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    const source = new FormData();
    source.set("file", new File([fileBytes], "a.png", { type: "image/png" }));
    source.set("productId", "1e6f3d64-2b3a-4a5e-9c2b-9a1f2c3d4e5f");
    const req = new Request("http://test/upload", {
      method: "POST",
      body: source,
    });
    const contentType = req.headers.get("content-type")!;
    expect(contentType).toContain("multipart/form-data");

    const buffered = await readCappedStream(req.body!, 1024 * 1024);
    const form = await new Response(new Uint8Array(buffered), {
      headers: { "content-type": contentType },
    }).formData();

    const file = form.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("a.png");
    expect(new Uint8Array(await (file as File).arrayBuffer())).toEqual(fileBytes);
    expect(form.get("productId")).toBe("1e6f3d64-2b3a-4a5e-9c2b-9a1f2c3d4e5f");
  });
});
