import "server-only";

import { settingsCollection } from "@/lib/db/mongo-collections";

/**
 * Typed access to the `settings` collection (keyed by the setting key as `_id`).
 *
 * Values are arbitrary documents, so every read is validated on the way out: a
 * hand-edited row must not be able to put a string where money is expected.
 */
export const SETTING_KEYS = {
  shippingCents: "order.shipping_cents",
  taxRateBp: "order.tax_rate_bp",
} as const;

export type OrderMoneySettings = {
  /** Flat shipping charge in the smallest currency unit. */
  shippingCents: number;
  /** VAT rate in basis points (2100 = 21%). */
  taxRateBp: number;
};

function asNonNegativeInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

/**
 * Fall back to the environment, then to zero.
 *
 * The env vars stay meaningful as a deployment default for a fresh database;
 * once someone saves the settings form, the row wins. Zero is the last resort
 * precisely because VAT is a legal figure that should be chosen, not inherited.
 */
function fromEnv(name: string): number {
  return asNonNegativeInt(process.env[name]) ?? 0;
}

export async function getOrderMoneySettings(): Promise<OrderMoneySettings> {
  const rows = await settingsCollection()
    .find({ _id: { $in: [SETTING_KEYS.shippingCents, SETTING_KEYS.taxRateBp] } })
    .toArray();

  const byKey = new Map(rows.map((row) => [row._id, row.value]));

  return {
    shippingCents:
      asNonNegativeInt(byKey.get(SETTING_KEYS.shippingCents)) ??
      fromEnv("ORDER_SHIPPING_CENTS"),
    taxRateBp:
      asNonNegativeInt(byKey.get(SETTING_KEYS.taxRateBp)) ??
      fromEnv("ORDER_TAX_RATE_BP"),
  };
}

/** Whether a value has been set explicitly, as opposed to inherited. */
export async function getConfiguredKeys(): Promise<Set<string>> {
  const rows = await settingsCollection()
    .find({}, { projection: { _id: 1 } })
    .toArray();
  return new Set(rows.map((row) => row._id));
}

export async function putSetting(
  key: string,
  value: unknown,
  description: string,
  actorId: string | null,
): Promise<void> {
  await settingsCollection().updateOne(
    { _id: key },
    { $set: { value, description, updatedBy: actorId, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await settingsCollection().deleteOne({ _id: key });
}
