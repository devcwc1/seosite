"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type DeleteResult,
  type MutationResult,
} from "@/lib/categories/mutations";
import {
  categoryInputSchema,
  type CategoryFormPayload,
} from "@/lib/categories/validation";
import { flattenZodErrors } from "@/lib/products/validation";

const VIEWER_MESSAGE = "Viewers cannot change categories.";

function revalidateCategories(id?: string) {
  revalidatePath("/categories");
  revalidatePath("/products");
  if (id) revalidatePath(`/categories/${id}/edit`);
}

export async function createCategoryAction(
  payload: CategoryFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) {
    return { ok: false, errors: { form: VIEWER_MESSAGE } };
  }

  const parsed = categoryInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const result = await createCategory(parsed.data, session.user.id);
  if (result.ok) revalidateCategories();
  return result;
}

export async function updateCategoryAction(
  id: string,
  payload: CategoryFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) {
    return { ok: false, errors: { form: VIEWER_MESSAGE } };
  }

  const parsed = categoryInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const result = await updateCategory(id, parsed.data, session.user.id);
  if (result.ok) revalidateCategories(id);
  return result;
}

export async function deleteCategoryAction(id: string): Promise<DeleteResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Not authenticated." };
  if (!isWriter(session.user)) return { ok: false, error: VIEWER_MESSAGE };

  const result = await deleteCategory(id, session.user.id);
  if (result.ok) revalidateCategories();
  return result;
}
