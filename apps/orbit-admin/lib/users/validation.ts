import { z } from "zod";

export type UserRole = "admin" | "editor" | "viewer";
export type UserAccountStatus = "active" | "disabled";

export type CreateUserPayload = {
  email: string;
  password: string;
  role: UserRole;
  mfaEnforced: boolean;
};

export type UpdateUserPayload = {
  email: string;
  /** Empty string = keep the current password. */
  password: string;
  role: UserRole;
  mfaEnforced: boolean;
  /** Force the user to re-enrol MFA on next sign-in. */
  resetMfaEnrollment: boolean;
  /** `disabled` blocks sign-in and revokes the user's live sessions. */
  status: UserAccountStatus;
};

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email")
  .max(320);
const role = z.enum(["admin", "editor", "viewer"]);
const MIN_PASSWORD = 8;

export const createUserSchema = z.object({
  email,
  password: z
    .string()
    .min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters`)
    .max(200),
  role,
  mfaEnforced: z.boolean(),
});

export const updateUserSchema = z.object({
  email,
  password: z
    .string()
    .max(200)
    .refine(
      (v) => v === "" || v.length >= MIN_PASSWORD,
      `At least ${MIN_PASSWORD} characters`,
    ),
  role,
  mfaEnforced: z.boolean(),
  resetMfaEnrollment: z.boolean(),
  status: z.enum(["active", "disabled"]),
});

export type CreateUserParsed = z.output<typeof createUserSchema>;
export type UpdateUserParsed = z.output<typeof updateUserSchema>;

/** Flatten Zod issues into a { field: message } map (first message wins). */
export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
