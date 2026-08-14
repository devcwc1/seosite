import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2 parameters. `@node-rs/argon2` defaults to the Argon2id variant, and
 * these settings track the OWASP Password Storage Cheat Sheet recommendation
 * (19 MiB memory, 2 iterations, 1 lane). The chosen parameters are encoded into
 * the resulting hash, so `verifyPassword` reads them back and does not need
 * them passed again.
 *
 * `algorithm` is left at the Argon2id default rather than referencing the
 * library's ambient const enum, which `isolatedModules` disallows.
 */
const HASH_OPTIONS = {
  memoryCost: 19_456, // KiB (= 19 MiB)
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

/** Hash a plaintext password for storage in `users.password_hash`. */
export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

/** Verify a plaintext password against a stored Argon2 hash. */
export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
