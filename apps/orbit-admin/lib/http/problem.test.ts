import { describe, expect, it } from "vitest";

import { problem, problemFor } from "./problem";

describe("problem (RFC 7807)", () => {
  it("sets the application/problem+json content type", () => {
    const res = problemFor(404);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    expect(res.status).toBe(404);
  });

  it("uses the standard title for a status and defaults type to about:blank", async () => {
    const res = problemFor(401, "Sign in required", {
      instance: "/api/uploads",
    });
    const body = await res.json();
    expect(body).toEqual({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Sign in required",
      instance: "/api/uploads",
    });
  });

  it("merges extension members", async () => {
    const res = problem({
      status: 413,
      title: "Payload Too Large",
      extensions: { maxBytes: 5_242_880 },
    });
    const body = await res.json();
    expect(body.maxBytes).toBe(5_242_880);
    expect(body.status).toBe(413);
  });
});
