"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/session";
import { putSetting, SETTING_KEYS } from "@/lib/settings/store";
import { recordAudit } from "@/lib/audit";

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
