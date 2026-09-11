import { z } from "zod";

/** What the category form sends. */
export type CategoryFormPayload = {
  name: string;
  slug: string;
  description: string;
  position: string;
  meta: { title: string; description: string; keywords: string };
};

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens only",
    ),
  /** Intro copy for the archive page. */
  description: z.string().trim().max(20000),
  position: z.coerce
    .number()
    .int("Position must be a whole number")
    .min(0, "Position cannot be negative")
    .max(999),
  meta: z.object({
    title: z.string().trim().max(255),
    description: z.string().trim().max(1000),
    keywords: z.string().trim().max(500),
  }),
});

export type CategoryParsed = z.output<typeof categoryInputSchema>;
