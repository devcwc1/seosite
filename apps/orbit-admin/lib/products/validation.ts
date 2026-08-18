import { z } from "zod";

/** Payload shape the client form sends (numeric text stays as strings). */
export type ProductReviewPayload = {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
};

export type ProductFormPayload = {
  title: string;
  slug: string;
  sku: string;
  status: "draft" | "published" | "archived";
  shortInfo: string;
  description: string;
  price: string;
  currency: string;
  inStock: boolean;
  stockQuantity: string;
  meta: { title: string; description: string; keywords: string };
  reviews: ProductReviewPayload[];
};

const reviewSchema = z.object({
  id: z.string().min(1),
  author: z.string().trim().min(1, "Reviewer name is required").max(200),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Rating must be 1–5")
    .max(5, "Rating must be 1–5"),
  title: z.string().trim().max(200),
  body: z.string().trim().min(1, "Review comment is required").max(4000),
  createdAt: z.string().min(1),
});

export const productInputSchema = z.object({
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
  sku: z.string().trim().min(1, "SKU is required").max(64),
  status: z.enum(["draft", "published", "archived"]),
  shortInfo: z.string().trim().max(512),
  description: z.string().trim().max(20000),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  currency: z.string().trim().toUpperCase().length(3, "Use a 3-letter code"),
  inStock: z.boolean(),
  stockQuantity: z.coerce
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative"),
  meta: z.object({
    title: z.string().trim().max(255),
    description: z.string().trim().max(1000),
    keywords: z.string().trim().max(500),
  }),
  reviews: z.array(reviewSchema),
});

export type ProductParsed = z.output<typeof productInputSchema>;

/** Flatten Zod issues into a { field: message } map (first message wins). */
export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

/** Derive a URL slug from a title. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
