import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { categoriesCollection } from "@/lib/db/mongo-collections";
import { mediaAssets, settings } from "@/lib/db/schema";
import { SITE_SEO_SETTING_KEY } from "@/lib/seo/site-settings";

import { deleteAsset, listAssets } from "./assets";
import { usageCounts, usageForAsset } from "./usage";

/**
 * Usage beyond products: category share images and the site-wide default
 * share image and logo. The site-wide ones matter most — every page without
 * an image of its own falls back to them.
 */

const suffix = Date.now().toString(36);
const assetIds: string[] = [];
let categoryId: string;
let categoryAsset: string;
let defaultOgAsset: string;
let logoAsset: string;

/** The settings row is shared state; whatever was there is put back. */
let originalSetting: { value: unknown; description: string | null } | undefined;

async function makeAsset(name: string): Promise<string> {
  const [row] = await db
    .insert(mediaAssets)
    .values({
      sha256: `us${suffix}${name}`.padEnd(64, "0").slice(0, 64),
      storageKey: `test/${suffix}/${name}.webp`,
      format: "webp",
      mimeType: "image/webp",
      width: 1200,
      height: 630,
      sizeBytes: 100,
      originalName: `usage-site-${suffix}-${name}.webp`,
    })
    .returning({ id: mediaAssets.id });
  assetIds.push(row!.id);
  return row!.id;
}

beforeAll(async () => {
  const [existing] = await db
    .select({ value: settings.value, description: settings.description })
    .from(settings)
    .where(eq(settings.key, SITE_SEO_SETTING_KEY));
  originalSetting = existing;

  categoryAsset = await makeAsset("category");
  defaultOgAsset = await makeAsset("defaultog");
  logoAsset = await makeAsset("logo");

  categoryId = randomUUID();
  const now = new Date();
  await categoriesCollection().insertOne({
    _id: categoryId,
    slug: `usage-site-${suffix}`,
    name: `Usage site ${suffix}`,
    description: null,
    meta: { ogImageAssetId: categoryAsset },
    position: 0,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  });

  const value = {
    ...((existing?.value as object) ?? {}),
    defaultOgImageAssetId: defaultOgAsset,
    logoAssetId: logoAsset,
  };
  await db
    .insert(settings)
    .values({ key: SITE_SEO_SETTING_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
});

afterAll(async () => {
  if (originalSetting) {
    await db
      .update(settings)
      .set({ value: originalSetting.value, description: originalSetting.description })
      .where(eq(settings.key, SITE_SEO_SETTING_KEY));
  } else {
    await db.delete(settings).where(eq(settings.key, SITE_SEO_SETTING_KEY));
  }
  await categoriesCollection().deleteOne({ _id: categoryId });
  for (const id of assetIds) await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  await pool.end();
});

describe("usage beyond products", () => {
  it("counts a category's share image", async () => {
    const usage = await usageForAsset(categoryAsset);

    expect(usage).toEqual([
      {
        kind: "categoryOgImage",
        targetId: categoryId,
        title: `Usage site ${suffix}`,
        href: `/categories/${categoryId}/edit`,
      },
    ]);
  });

  it("counts the site-wide default share image and logo", async () => {
    expect((await usageForAsset(defaultOgAsset)).map((u) => u.kind)).toEqual([
      "siteDefaultOgImage",
    ]);
    expect((await usageForAsset(logoAsset)).map((u) => u.kind)).toEqual(["siteLogo"]);
  });

  it("includes them in the grid's counts", async () => {
    const counts = await usageCounts([categoryAsset, defaultOgAsset, logoAsset]);

    expect(counts.get(categoryAsset)).toBe(1);
    expect(counts.get(defaultOgAsset)).toBe(1);
    expect(counts.get(logoAsset)).toBe(1);
  });

  it("treats them as used in the library filter", async () => {
    const unused = await listAssets({ query: `usage-site-${suffix}`, usage: "unused" });

    expect(unused.items).toHaveLength(0);
  });

  it("refuses to delete the image every page falls back to", async () => {
    expect((await deleteAsset(defaultOgAsset, null)).ok).toBe(false);
    expect((await deleteAsset(categoryAsset, null)).ok).toBe(false);
  });
});
