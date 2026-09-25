"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import {
  createPost,
  deletePost,
  updatePost,
  type MutationResult,
} from "@/lib/blog/mutations";
import { postInputSchema, type PostFormPayload } from "@/lib/blog/validation";
import { flattenZodErrors } from "@/lib/products/validation";

const VIEWER_MESSAGE = "Viewers cannot change posts.";

function revalidateBlog(id?: string) {
  revalidatePath("/blog");
  if (id) revalidatePath(`/blog/${id}/edit`);
}

export async function createPostAction(
  payload: PostFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) return { ok: false, errors: { form: VIEWER_MESSAGE } };

  const parsed = postInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: flattenZodErrors(parsed.error) };

  const result = await createPost(parsed.data, session.user.id);
  if (result.ok) revalidateBlog();
  return result;
}

export async function updatePostAction(
  id: string,
  payload: PostFormPayload,
): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) return { ok: false, errors: { form: VIEWER_MESSAGE } };

  const parsed = postInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: flattenZodErrors(parsed.error) };

  const result = await updatePost(id, parsed.data, session.user.id);
  if (result.ok) revalidateBlog(id);
  return result;
}

export async function deletePostAction(id: string): Promise<MutationResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, errors: { form: "Not authenticated." } };
  if (!isWriter(session.user)) return { ok: false, errors: { form: VIEWER_MESSAGE } };

  const result = await deletePost(id, session.user.id);
  if (result.ok) revalidateBlog();
  return result;
}
