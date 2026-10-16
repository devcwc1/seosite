import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mongoClient } from "./mongo";
import {
  COLLECTIONS,
  usersCollection,
  productsCollection,
  type UserDoc,
} from "./mongo-collections";
import { ensureIndexes, INDEX_NAMES } from "./mongo-indexes";

/**
 * Integration against the dev MongoDB (single-node replica set). Verifies that
 * the index layer sets up — and actually enforces — the constraints that the
 * Postgres unique indexes used to.
 */

const createdUserIds: string[] = [];

function userDoc(over: Partial<UserDoc> & { email: string }): UserDoc {
  return {
    _id: `idx-test-${Math.random().toString(36).slice(2)}`,
    passwordHash: "not-a-real-hash",
    role: "editor",
    status: "active",
    mfaEnforced: false,
    mfaEnrolled: false,
    createdAt: new Date(),
    ...over,
  };
}

beforeAll(async () => {
  await ensureIndexes();
  // Idempotent: a second run must not throw.
  await ensureIndexes();
});

afterAll(async () => {
  if (createdUserIds.length) {
    await usersCollection().deleteMany({ _id: { $in: createdUserIds } });
  }
  await mongoClient.close();
});

describe("mongo index setup", () => {
  it("creates the declared unique indexes on users and products", async () => {
    const userIndexes = await usersCollection().indexes();
    const emailIdx = userIndexes.find((i) => i.name === "users_email_unique");
    expect(emailIdx?.unique).toBe(true);

    const productIndexes = await productsCollection().indexes();
    const names = productIndexes.map((i) => i.name);
    expect(names).toContain("products_slug_unique");
    expect(names).toContain("products_sku_unique");
    expect(names).toContain("products_media_asset_idx");
  });

  it("declares an index set for every collection that needs one", () => {
    // settings is keyed by _id only, so it is deliberately absent.
    expect(Object.keys(INDEX_NAMES)).toContain(COLLECTIONS.users);
    expect(Object.keys(INDEX_NAMES)).toContain(COLLECTIONS.orders);
    expect(INDEX_NAMES[COLLECTIONS.posts]).toContain("posts_slug_unique");
  });
});

describe("unique constraints actually enforce", () => {
  it("rejects a duplicate email", async () => {
    const email = `dupe-${Date.now()}@example.test`;

    const first = userDoc({ email });
    createdUserIds.push(first._id);
    await usersCollection().insertOne(first);

    const second = userDoc({ email });
    createdUserIds.push(second._id);
    await expect(usersCollection().insertOne(second)).rejects.toThrow(
      /duplicate key/i,
    );
  });
});
