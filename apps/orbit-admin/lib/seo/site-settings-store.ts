import "server-only";

import { settingsCollection } from "@/lib/db/mongo-collections";
import { putSetting } from "@/lib/settings/store";

import {
  parseStoredSiteSeoSettings,
  SITE_SEO_SETTING_KEY,
  type SiteSeoSettings,
} from "./site-settings";

export async function getSiteSeoSettings(): Promise<SiteSeoSettings> {
  const row = await settingsCollection().findOne(
    { _id: SITE_SEO_SETTING_KEY },
    { projection: { value: 1 } },
  );

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
