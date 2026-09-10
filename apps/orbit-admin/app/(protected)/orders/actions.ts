"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import { setOrderStatus, type StatusChangeResult } from "@/lib/orders/mutations";
import { orderStatus } from "@/lib/db/schema";

/** Move an order along its lifecycle. Viewers may read orders, not change them. */
export async function setOrderStatusAction(
  formData: FormData,
): Promise<StatusChangeResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Not authenticated." };
  if (!isWriter(session.user)) {
    return { ok: false, error: "Viewers cannot change orders." };
  }

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("status") ?? "");

  if (!id) return { ok: false, error: "Missing order." };
  if (!orderStatus.enumValues.includes(next as never)) {
    return { ok: false, error: "Unknown status." };
  }

  const result = await setOrderStatus(
    id,
    next as (typeof orderStatus.enumValues)[number],
    session.user.id,
  );

  if (result.ok) {
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
  }

  return result;
}
