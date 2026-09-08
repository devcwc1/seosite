import { describe, expect, it } from "vitest";

import { isAdmin, isWriter } from "./session";

/**
 * The role policy in one place. These are the rules every content mutation and
 * every user-management action defers to, so a change here should be a
 * deliberate one rather than a side effect.
 */
describe("role policy", () => {
  it("lets admins and editors change content", () => {
    expect(isWriter({ role: "admin" })).toBe(true);
    expect(isWriter({ role: "editor" })).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(isWriter({ role: "viewer" })).toBe(false);
  });

  it("reserves user management for admins", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({ role: "editor" })).toBe(false);
    expect(isAdmin({ role: "viewer" })).toBe(false);
  });
});
