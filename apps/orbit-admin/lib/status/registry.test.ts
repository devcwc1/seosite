import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  PAGE_STATUSES,
  POST_STATUSES,
  PRODUCT_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from "@/lib/db/model-types";

import {
  LIVE_DOMAINS,
  STATUS_REGISTRY,
  statusEntry,
  type StatusTone,
} from "./registry";

const TONES: StatusTone[] = [
  "neutral",
  "success",
  "warning",
  "danger",
  "info",
];

describe("the canonical status registry", () => {
  it("covers every value of every enum it claims to describe", () => {
    // The registry is only canonical if it is exhaustive. If someone adds
    // `refunded` to the order enum, this fails before a screen can invent a
    // colour for it.
    expect(Object.keys(STATUS_REGISTRY.product).sort()).toEqual(
      [...PRODUCT_STATUSES].sort(),
    );
    expect(Object.keys(STATUS_REGISTRY.post).sort()).toEqual(
      [...POST_STATUSES].sort(),
    );
    expect(Object.keys(STATUS_REGISTRY.page).sort()).toEqual(
      [...PAGE_STATUSES].sort(),
    );
    expect(Object.keys(STATUS_REGISTRY.order).sort()).toEqual(
      [...ORDER_STATUSES].sort(),
    );
    expect(Object.keys(STATUS_REGISTRY.role).sort()).toEqual(
      [...USER_ROLES].sort(),
    );
    expect(Object.keys(STATUS_REGISTRY.account).sort()).toEqual(
      [...USER_STATUSES].sort(),
    );
  });

  it("names exactly the domains that have a column behind them", () => {
    expect(LIVE_DOMAINS.sort()).toEqual([
      "account",
      "order",
      "page",
      "post",
      "product",
      "role",
    ]);
  });

  it("uses only the five sanctioned tones", () => {
    for (const [domain, values] of Object.entries(STATUS_REGISTRY)) {
      for (const [value, entry] of Object.entries(values)) {
        expect(TONES, `${domain}.${value}`).toContain(entry.tone);
      }
    }
  });

  it("gives every status a non-empty human label", () => {
    for (const [domain, values] of Object.entries(STATUS_REGISTRY)) {
      for (const [value, entry] of Object.entries(values)) {
        expect(entry.label.length, `${domain}.${value}`).toBeGreaterThan(0);
      }
    }
  });

  it("maps the statuses doc 15 calls out by name", () => {
    expect(statusEntry("product", "draft").tone).toBe("neutral");
    expect(statusEntry("product", "published").tone).toBe("success");
    expect(statusEntry("indexing", "noindex").tone).toBe("warning");
  });

  it("explains a status whose label alone would not carry the meaning", () => {
    // Colour must never be the only signal (WCAG 1.4.1). "No-index" means
    // nothing to a reader who does not already know the jargon.
    expect(statusEntry("indexing", "noindex").description).toBeTruthy();
  });
});
