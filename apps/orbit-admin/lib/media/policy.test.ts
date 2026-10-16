import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { USER_ROLES } from "@/lib/db/model-types";

import { canDeleteMedia, canEditMedia, canUploadMedia } from "./policy";

const ADMIN = { role: "admin" as const };
const EDITOR = { role: "editor" as const };
const VIEWER = { role: "viewer" as const };

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("media policy", () => {
  it("lets admins and editors upload, but not viewers", () => {
    expect(canUploadMedia(ADMIN)).toBe(true);
    expect(canUploadMedia(EDITOR)).toBe(true);
    expect(canUploadMedia(VIEWER)).toBe(false);
  });

  it("lets admins and editors edit metadata, but not viewers", () => {
    expect(canEditMedia(ADMIN)).toBe(true);
    expect(canEditMedia(EDITOR)).toBe(true);
    expect(canEditMedia(VIEWER)).toBe(false);
  });

  it("lets only admins delete", () => {
    // ORB-505's security note: delete is Admin-only. An editor curates the
    // library; destroying shared work is a narrower right than adding to it.
    expect(canDeleteMedia(ADMIN)).toBe(true);
    expect(canDeleteMedia(EDITOR)).toBe(false);
    expect(canDeleteMedia(VIEWER)).toBe(false);
  });

  it("decides for every role the database can hold", () => {
    // A new role must not fall through to an accidental allow.
    for (const role of USER_ROLES) {
      for (const decide of [canUploadMedia, canEditMedia, canDeleteMedia]) {
        expect(typeof decide({ role })).toBe("boolean");
      }
    }
  });

  it("is strictly narrower for delete than for edit", () => {
    for (const role of USER_ROLES) {
      if (canDeleteMedia({ role })) {
        expect(canEditMedia({ role }), `${role} may delete but not edit`).toBe(
          true,
        );
      }
    }
  });
});

describe("the routes actually use the policy", () => {
  // The UI hiding a button is courtesy; these guards are the control. A route
  // that reverts to isWriter would silently widen who can destroy an asset,
  // and no component test would notice.
  it("guards DELETE and PATCH through the policy, not a role check", () => {
    const route = source("app/api/v1/media/[id]/route.ts");

    expect(route).toContain("canDeleteMedia(session.user)");
    expect(route).toContain("canEditMedia(session.user)");
    expect(route).not.toContain("isWriter");
  });

  it("guards upload through the policy", () => {
    const route = source("app/api/v1/media/upload/route.ts");

    expect(route).toContain("canUploadMedia(session.user)");
    expect(route).not.toContain("isWriter");
  });
});
