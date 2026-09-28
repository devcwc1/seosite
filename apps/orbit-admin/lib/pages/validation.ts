import { z } from "zod";

import { seoMetaInputSchema } from "@/lib/seo/meta";

/** What the page form sends. */
export type PageFormPayload = {
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  content: string;
  meta: {
    title: string;
    description: string;
    keywords: string;
    ogImageAssetId: string;
    noindex: boolean;
    canonicalUrl: string;
  };
};

export const pageInputSchema = z.object({
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
  // Rich text; sanitised on write, so a generous ceiling not a tight one.
  content: z.string().trim().max(200000),
  meta: seoMetaInputSchema,
});

export type PageParsed = z.output<typeof pageInputSchema>;
