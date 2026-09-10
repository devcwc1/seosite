import { z } from "zod";

/**
 * What a storefront may send when placing an order.
 *
 * Note what is absent: prices, totals, currency. The client says *what* it
 * wants and *how many*; every amount is computed here from the catalog, so a
 * tampered or merely stale payload can never set its own price.
 */
export const orderInputSchema = z.object({
  email: z.string().trim().email("A valid email address is required").max(255),
  phone: z.string().trim().max(64).optional().or(z.literal("")),
  shipping: z.object({
    name: z.string().trim().min(1, "Name is required").max(255),
    street: z.string().trim().min(1, "Street and number are required").max(255),
    postcode: z.string().trim().min(1, "Postcode is required").max(32),
    city: z.string().trim().min(1, "City is required").max(128),
    /** ISO 3166-1 alpha-2, upper-cased. */
    country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, "Country must be a two-letter code"),
  }),
  items: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(255),
        quantity: z.coerce.number().int().min(1).max(99),
      }),
    )
    .min(1, "An order needs at least one item")
    .max(50),
});

export type OrderInput = z.output<typeof orderInputSchema>;
