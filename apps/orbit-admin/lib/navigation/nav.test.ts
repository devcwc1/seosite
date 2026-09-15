import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ADMIN_ONLY_PREFIXES, navigationFor } from "./nav";

const ROLES = {
  admin: { role: "admin" as const },
  editor: { role: "editor" as const },
  viewer: { role: "viewer" as const },
};

function hrefs(role: keyof typeof ROLES): string[] {
  return navigationFor(ROLES[role]).map((item) => item.href);
}

describe("role-aware navigation", () => {
  it("gives an admin every item", () => {
    expect(hrefs("admin")).toEqual([
      "/dashboard",
      "/products",
      "/categories",
      "/orders",
      "/media",
      "/users",
      "/settings",
    ]);
  });

  it("hides admin-only items from an editor", () => {
    expect(hrefs("editor")).not.toContain("/users");
  });

  it("hides admin-only items from a viewer", () => {
    expect(hrefs("viewer")).not.toContain("/users");
  });

  it("still shows an editor everything that is not admin-only", () => {
    // The point is to remove exactly the unusable links and nothing else.
    for (const href of ["/dashboard", "/products", "/categories", "/orders", "/media"]) {
      expect(hrefs("editor")).toContain(href);
    }
  });

  it("leaves settings visible to every role", () => {
    // Settings renders read-only for non-admins rather than refusing them,
    // so hiding it would take away something they can legitimately use.
    expect(hrefs("editor")).toContain("/settings");
    expect(hrefs("viewer")).toContain("/settings");
  });

  /**
   * FR-SEC-006. This is the test that matters: hiding a link is courtesy,
   * and courtesy that is mistaken for a control is a vulnerability. Every
   * route the nav hides must refuse the request on the server.
   */
  it("guards every route it hides, server-side", () => {
    expect(ADMIN_ONLY_PREFIXES.length).toBeGreaterThan(0);

    const ROUTES: Record<string, string[]> = {
      "/users": [
        "app/(protected)/users/page.tsx",
        "app/(protected)/users/new/page.tsx",
        "app/(protected)/users/[id]/edit/page.tsx",
      ],
    };

    for (const prefix of ADMIN_ONLY_PREFIXES) {
      const files = ROUTES[prefix];
      expect(files, `no route files listed for ${prefix}`).toBeTruthy();

      for (const file of files!) {
        const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
        expect(source, `${file} must check isAdmin`).toContain("isAdmin(session.user)");
        expect(source, `${file} must answer 403, not redirect`).toContain("forbidden()");
      }
    }
  });
});
