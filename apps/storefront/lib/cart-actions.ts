"use server";

import { revalidatePath } from "next/cache";

import {
  MAX_QUANTITY,
  readCart,
  writeCart,
  type CartLine,
} from "@/lib/cart";

/**
 * Cart mutations, as server actions so the buttons are plain forms: the cart
 * works with JavaScript disabled, and there is no client bundle for it.
 */

function clampQuantity(value: FormDataEntryValue | null, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(parsed)));
}

function requireSlug(formData: FormData): string | null {
  const slug = formData.get("slug");
  return typeof slug === "string" && slug !== "" ? slug : null;
}

/** Add to the cart, or raise the quantity if the line is already there. */
export async function addToCartAction(formData: FormData): Promise<void> {
  const slug = requireSlug(formData);
  if (!slug) return;

  const quantity = clampQuantity(formData.get("quantity"));
  const lines = await readCart();
  const existing = lines.find((line) => line.slug === slug);

  const next: CartLine[] = existing
    ? lines.map((line) =>
        line.slug === slug
          ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) }
          : line,
      )
    : [...lines, { slug, quantity }];

  await writeCart(next);
  revalidatePath("/", "layout");
}

/** Set an exact quantity; zero or less removes the line. */
export async function setQuantityAction(formData: FormData): Promise<void> {
  const slug = requireSlug(formData);
  if (!slug) return;

  const raw = Number(formData.get("quantity"));
  const lines = await readCart();

  if (!Number.isFinite(raw) || raw < 1) {
    await writeCart(lines.filter((line) => line.slug !== slug));
  } else {
    const quantity = clampQuantity(formData.get("quantity"));
    await writeCart(
      lines.map((line) => (line.slug === slug ? { ...line, quantity } : line)),
    );
  }

  revalidatePath("/", "layout");
}

export async function removeLineAction(formData: FormData): Promise<void> {
  const slug = requireSlug(formData);
  if (!slug) return;

  const lines = await readCart();
  await writeCart(lines.filter((line) => line.slug !== slug));
  revalidatePath("/", "layout");
}

export async function clearCartAction(): Promise<void> {
  await writeCart([]);
  revalidatePath("/", "layout");
}
