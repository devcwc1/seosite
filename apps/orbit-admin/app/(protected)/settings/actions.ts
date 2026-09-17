"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/session";
import { putSetting, SETTING_KEYS } from "@/lib/settings/store";
import { recordAudit } from "@/lib/audit";
import { siteSeoSettingsSchema } from "@/lib/seo/site-settings";
import {
  getSiteSeoSettings,
  saveSiteSeoSettings,
} from "@/lib/seo/site-settings-store";

export type SettingsResult = { ok: boolean; error?: string };

/**
 * Money rules are admin-only: they decide what customers are charged, so they
 * sit with user management rather than with everyday editing.
 */
export async function saveOrderSettingsAction(
  formData: FormData,
): Promise<SettingsResult> {
  const session = await requireAdminSession();
  if (!session) {
    return { ok: false, error: "Only admins can change these settings." };
  }

  // Entered in euros and percent, stored as cents and basis points — integers,
  // so no float drift creeps into an invoice.
  const shipping = Number(formData.get("shipping"));
  const vat = Number(formData.get("vat"));

  if (!Number.isFinite(shipping) || shipping < 0) {
    return { ok: false, error: "Shipping must be zero or more." };
  }
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    return { ok: false, error: "VAT must be between 0 and 100 percent." };
  }

  const shippingCents = Math.round(shipping * 100);
  const taxRateBp = Math.round(vat * 100);

  await putSetting(
    SETTING_KEYS.shippingCents,
    shippingCents,
    "Flat shipping charge applied to new orders, in cents.",
    session.user.id,
  );
  await putSetting(
    SETTING_KEYS.taxRateBp,
    taxRateBp,
    "VAT rate applied to new orders, in basis points.",
    session.user.id,
  );

  await recordAudit({
    actorId: session.user.id,
    action: "settings.orders_updated",
    target: "settings:orders",
    metadata: { shippingCents, taxRateBp },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export type SeoSettingsResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

/**
 * Site-wide search settings are admin-only for the same reason as money:
 * one wrong value — indexing switched off, a bad site URL — affects every
 * page of the storefront at once.
 */
export async function saveSeoSettingsAction(
  input: unknown,
): Promise<SeoSettingsResult> {
  const session = await requireAdminSession();
  if (!session) {
    return { ok: false, errors: { form: "Only admins can change these settings." } };
  }

  const parsed = siteSeoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }

  const previous = await getSiteSeoSettings();
  await saveSiteSeoSettings(parsed.data, session.user.id);

  await recordAudit({
    actorId: session.user.id,
    action: "settings.seo_updated",
    target: "settings:seo",
    // Indexing is the one change worth finding quickly in an audit trail.
    metadata: {
      allowIndexing: parsed.data.allowIndexing,
      indexingChanged: previous.allowIndexing !== parsed.data.allowIndexing,
      siteUrl: parsed.data.siteUrl,
    },
  });

  revalidatePath("/settings");
  return { ok: true };
}
