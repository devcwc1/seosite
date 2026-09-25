import { z } from "zod";

import { seoMetaInputSchema } from "@/lib/seo/meta";

/** What the post form sends (numeric/date text stays as strings). */
export type PostFormPayload = {
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  excerpt: string;
  body: string;
  coverImageAssetId: string;
  /** ISO date (yyyy-mm-dd) or ""; empty means "set automatically on publish". */
  publishedAt: string;
  meta: {
    title: string;
    description: string;
    keywords: string;
    ogImageAssetId: string;
    noindex: boolean;
    canonicalUrl: string;
  };
};

export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens only",
    ),
  status: z.enum(["draft", "published", "archived"]),
  excerpt: z.string().trim().max(1000),
  // Rich text; sanitised on write, so a generous ceiling not a tight one.
  body: z.string().trim().max(100000),
  coverImageAssetId: z
    .union([z.literal(""), z.string().uuid("Invalid image reference")])
    .default(""),
  // Empty is valid: the mutation stamps the publish time on first publish.
  publishedAt: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a yyyy-mm-dd date")])
    .default(""),
  meta: seoMetaInputSchema,
});

export type PostParsed = z.output<typeof postInputSchema>;
