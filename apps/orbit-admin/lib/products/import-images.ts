import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { processUpload } from "@/lib/media/process";

/**
 * Fetching an image named by an import URL, safely, into the ORB-501 intake.
 *
 * Importing images means the server fetches URLs a file supplied, which is a
 * request-forgery risk: a URL pointing at an internal address would make the
 * server fetch things a browser never could. So every URL is resolved and its
 * address checked against private ranges before a byte is fetched, the fetch
 * is capped and timed out, and whatever comes back still goes through the same
 * sniff-and-re-encode intake as a manual upload — nothing is trusted for being
 * an "image URL".
 */

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 15 * 1024 * 1024;

/** Reject loopback, link-local, and the private IPv4/IPv6 ranges. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return (
      v === "::1" ||
      v.startsWith("fc") ||
      v.startsWith("fd") ||
      v.startsWith("fe80") ||
      v.startsWith("::ffff:") // IPv4-mapped; the v4 rules below cover the rest
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable is not worth trusting
  }
  const a = parts[0]!;
  const b = parts[1]!;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast / reserved
  );
}

export type ImageFetchResult =
  | { ok: true; assetId: string }
  | { ok: false; url: string; error: string };

export async function fetchImageAsset(
  url: string,
  actorId: string | null,
): Promise<ImageFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, url, error: "Not a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, url, error: "Only http and https URLs are fetched." };
  }

  // Resolve the host and refuse anything that points inward. A literal IP is
  // checked directly; a name is resolved and every answer checked.
  try {
    const host = parsed.hostname;
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      return { ok: false, url, error: "Refusing to fetch a private or unresolved address." };
    }
  } catch {
    return { ok: false, url, error: "Could not resolve the host." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, { signal: controller.signal, redirect: "error" });
    if (!response.ok) {
      return { ok: false, url, error: `The server responded ${response.status}.` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return { ok: false, url, error: "The file was empty." };
    if (buffer.length > MAX_BYTES) return { ok: false, url, error: "Larger than 15 MB." };

    const name = decodeURIComponent(parsed.pathname.split("/").pop() || "image");
    const file = new File([buffer], name, {
      type: response.headers.get("content-type") ?? "application/octet-stream",
    });
    // The intake sniffs magic bytes, enforces bounds, dedupes by hash and
    // re-encodes — so a re-import of the same URL yields the same asset.
    const { asset } = await processUpload(file, actorId);
    return { ok: true, assetId: asset.id };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, url, error: aborted ? "Timed out." : "Could not be fetched or was not an image." };
  } finally {
    clearTimeout(timer);
  }
}
