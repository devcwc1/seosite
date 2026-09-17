import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { putSetting } from "@/lib/settings/store";

import {
  parseStoredSiteSeoSettings,
  SITE_SEO_SETTING_KEY,
  type SiteSeoSettings,
} from "./site-settings";

export async function getSiteSeoSettings(): Promise<SiteSeoSettings> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SITE_SEO_SETTING_KEY))
    .limit(1);

  return parseStoredSiteSeoSettings(row?.value);
}

export async function saveSiteSeoSettings(
  value: SiteSeoSettings,
  actorId: string | null,
): Promise<void> {
  await putSetting(
    SITE_SEO_SETTING_KEY,
    value,
    "Site-wide search and social settings used by the storefront.",
    actorId,
  );
}
