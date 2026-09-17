import type { StorefrontSite } from "@orbit/next";

import { getSiteSeoSettings } from "@/lib/seo/site-settings-store";

import { assetUrlsById } from "./assets";

/**
 * Site-wide SEO settings as the storefront reads them. Empty strings become
 * null so a consumer never has to wonder whether "" means "set to nothing".
 */
export async function getStorefrontSite(): Promise<StorefrontSite> {
  const settings = await getSiteSeoSettings();
  const urls = await assetUrlsById([settings.defaultOgImageAssetId, settings.logoAssetId]);

  return {
    siteName: settings.siteName,
    titleTemplate: settings.titleTemplate,
    siteUrl: settings.siteUrl || null,
    defaultDescription: settings.defaultDescription || null,
    defaultOgImageUrl: urls.get(settings.defaultOgImageAssetId) ?? null,
    logoUrl: urls.get(settings.logoAssetId) ?? null,
    twitterHandle: settings.twitterHandle || null,
    allowIndexing: settings.allowIndexing,
    robotsExtra: settings.robotsExtra,
  };
}
