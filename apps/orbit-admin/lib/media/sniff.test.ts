import { describe, expect, it } from "vitest";

import { sniffImageFormat } from "./sniff";

function padded(bytes: number[]): Uint8Array {
  const out = new Uint8Array(Math.max(12, bytes.length));
  out.set(bytes);
  return out;
}

describe("sniffImageFormat", () => {
  it("detects JPEG", () => {
    expect(sniffImageFormat(padded([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });

  it("detects PNG", () => {
    expect(
      sniffImageFormat(padded([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("png");
  });

  it("detects WebP", () => {
    const b = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageFormat(b)).toBe("webp");
  });

  it("detects AVIF", () => {
    const b = new Uint8Array(16);
    b.set([0x00, 0x00, 0x00, 0x18], 0);
    b.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
    b.set([0x61, 0x76, 0x69, 0x66], 8); // "avif"
    expect(sniffImageFormat(b)).toBe("avif");
  });

  it("treats PDF bytes as unknown (polyglot defense)", () => {
    expect(
      sniffImageFormat(new TextEncoder().encode("%PDF-1.4 …payload…padding…")),
    ).toBe("unknown");
  });

  it("flags SVG for rejection", () => {
    expect(
      sniffImageFormat(new TextEncoder().encode('<svg xmlns="…"></svg>   ')),
    ).toBe("svg");
  });

  it("flags XML-declared SVG", () => {
    expect(
      sniffImageFormat(
        new TextEncoder().encode('<?xml version="1.0"?><svg></svg>'),
      ),
    ).toBe("svg");
  });

  it("treats a too-short buffer as unknown", () => {
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8]))).toBe("unknown");
  });
});
