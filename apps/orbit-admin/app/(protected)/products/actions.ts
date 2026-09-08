"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import {
  linkAssetToProduct,
  unlinkAssetFromProduct,
} from "@/lib/media/assets";
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

/** Shown to a viewer who reaches a write action anyway (e.g. a stale page). */
const VIEWER_MESSAGE = "Viewers cannot change products.";

export async function createProductAction(
  payload: ProductFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) {
    return { ok: false, errors: { form: VIEWER_MESSAGE } };
  }

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
  if (!isWriter(session.user)) {
    return { ok: false, errors: { form: VIEWER_MESSAGE } };
  }

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

export type GalleryActionResult = { ok: boolean; error?: string };

/** Link already-uploaded library assets to a product (detail-page quick add). */
export async function addProductImagesAction(
  productId: string,
  assetIds: string[],
): Promise<GalleryActionResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Not authenticated." };
  if (!isWriter(session.user)) {
    return { ok: false, error: "Viewers cannot edit product media." };
  }

  try {
    for (const assetId of assetIds) {
      await linkAssetToProduct(productId, assetId);
    }
  } catch {
    return { ok: false, error: "Failed to add images." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
  revalidatePath("/products");
  return { ok: true };
}

/** Remove one asset from a product's gallery (detail-page quick remove). */
export async function removeProductImageAction(
  productId: string,
  assetId: string,
): Promise<GalleryActionResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Not authenticated." };
  if (!isWriter(session.user)) {
    return { ok: false, error: "Viewers cannot edit product media." };
  }

  try {
    await unlinkAssetFromProduct(productId, assetId);
  } catch {
    return { ok: false, error: "Failed to remove image." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProductAction(
  id: string,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) {
    return { ok: false, errors: { form: VIEWER_MESSAGE } };
  }

  const result = await deleteProduct(id, session.user.id);
  if (result.ok) revalidatePath("/products");
  return result;
}
