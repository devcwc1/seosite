"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import {
  createPage,
  deletePage,
  updatePage,
  type MutationResult,
} from "@/lib/pages/mutations";
import { pageInputSchema, type PageFormPayload } from "@/lib/pages/validation";
import { flattenZodErrors } from "@/lib/products/validation";

const VIEWER_MESSAGE = "Viewers cannot change pages.";

function revalidatePages(id?: string) {
  revalidatePath("/pages");
  if (id) revalidatePath(`/pages/${id}/edit`);
}

export async function createPageAction(
  payload: PageFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) return { ok: false, errors: { form: VIEWER_MESSAGE } };

  const parsed = pageInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: flattenZodErrors(parsed.error) };

  const result = await createPage(parsed.data, session.user.id);
  if (result.ok) revalidatePages();
  return result;
}

export async function updatePageAction(
  id: string,
  payload: PageFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) return { ok: false, errors: { form: VIEWER_MESSAGE } };

  const parsed = pageInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: flattenZodErrors(parsed.error) };

  const result = await updatePage(id, parsed.data, session.user.id);
  if (result.ok) revalidatePages(id);
  return result;
}

export async function deletePageAction(id: string): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) return { ok: false, errors: { form: VIEWER_MESSAGE } };

  const result = await deletePage(id, session.user.id);
  if (result.ok) revalidatePages();
  return result;
}
