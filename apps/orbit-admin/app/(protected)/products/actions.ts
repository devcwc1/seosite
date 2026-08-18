"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/session";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  type MutationResult,
} from "@/lib/products/mutations";
import {
  flattenZodErrors,
  productInputSchema,
  type ProductFormPayload,
} from "@/lib/products/validation";

export async function createProductAction(
  payload: ProductFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };

  const parsed = productInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const result = await createProduct(parsed.data, session.user.id);
  if (result.ok) revalidatePath("/products");
  return result;
}

export async function updateProductAction(
  id: string,
  payload: ProductFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };

  const parsed = productInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const result = await updateProduct(id, parsed.data, session.user.id);
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath(`/products/${id}/edit`);
  }
  return result;
}

export async function deleteProductAction(
  id: string,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };

  const result = await deleteProduct(id, session.user.id);
  if (result.ok) revalidatePath("/products");
  return result;
}
