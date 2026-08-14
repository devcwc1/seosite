import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies against the original", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword(hash, "correct horse battery staple"),
    ).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret-passphrase");

    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("salts each hash so identical inputs differ", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-input"),
      hashPassword("same-input"),
    ]);

    expect(a).not.toEqual(b);
  });
});
