"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/session";
import {
  createUser,
  deleteUser,
  updateUser,
  type UserMutationResult,
} from "@/lib/users/mutations";
import {
  createUserSchema,
  flattenZodErrors,
  updateUserSchema,
  type CreateUserPayload,
  type UpdateUserPayload,
} from "@/lib/users/validation";

const FORBIDDEN: UserMutationResult = {
  ok: false,
  errors: { form: "You don't have permission to manage users." },
};

export async function createUserAction(
  payload: CreateUserPayload,
): Promise<UserMutationResult> {
  const session = await requireAdminSession();
  if (!session) return FORBIDDEN;

  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const result = await createUser(parsed.data, session.user.id);
  if (result.ok) revalidatePath("/users");
  return result;
}

export async function updateUserAction(
  id: string,
  payload: UpdateUserPayload,
): Promise<UserMutationResult> {
  const session = await requireAdminSession();
  if (!session) return FORBIDDEN;

  const parsed = updateUserSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: flattenZodErrors(parsed.error) };
  }

  const result = await updateUser(id, parsed.data, session.user.id);
  if (result.ok) {
    revalidatePath("/users");
    revalidatePath(`/users/${id}/edit`);
  }
  return result;
}

export async function deleteUserAction(
  id: string,
): Promise<UserMutationResult> {
  const session = await requireAdminSession();
  if (!session) return FORBIDDEN;

  const result = await deleteUser(id, session.user.id);
  if (result.ok) revalidatePath("/users");
  return result;
}
