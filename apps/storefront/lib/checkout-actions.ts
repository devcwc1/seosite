"use server";

import { redirect } from "next/navigation";
import { OrbitOrderError } from "@orbit/next";

import { readCart, writeCart } from "@/lib/cart";
import {
  isComplete,
  readCheckoutDetails,
  writeCheckoutDetails,
  type CheckoutDetails,
} from "@/lib/checkout";
import { orbit } from "@/lib/orbit";

/**
 * Checkout steps as server actions. Errors come back as a query parameter
 * rather than client state: the flow stays server-rendered, and a failed
 * attempt is a real URL the customer can reload.
 */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveDetailsAction(formData: FormData): Promise<void> {
  const details: CheckoutDetails = {
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    name: field(formData, "name"),
    street: field(formData, "street"),
    postcode: field(formData, "postcode"),
    city: field(formData, "city"),
    country: field(formData, "country").toUpperCase(),
  };

  await writeCheckoutDetails(details);

  if (!isComplete(details)) {
    redirect("/checkout?error=missing");
  }

  redirect("/checkout/payment");
}

export async function placeOrderAction(): Promise<void> {
  const [lines, details] = await Promise.all([
    readCart(),
    readCheckoutDetails(),
  ]);

  if (lines.length === 0) redirect("/cart");
  if (!isComplete(details)) redirect("/checkout?error=missing");

  let orderNumber: string;

  try {
    const confirmation = await orbit.createOrder({
      email: details!.email,
      phone: details!.phone || undefined,
      shipping: {
        name: details!.name,
        street: details!.street,
        postcode: details!.postcode,
        city: details!.city,
        country: details!.country,
      },
      items: lines.map((line) => ({
        slug: line.slug,
        quantity: line.quantity,
      })),
    });
    orderNumber = confirmation.orderNumber;
  } catch (error) {
    // Orbit's refusals are written for a customer ("out of stock: tee"), so
    // they are worth showing; anything else is ours to hide.
    const message =
      error instanceof OrbitOrderError
        ? error.detail
        : "The order could not be placed. Please try again.";

    redirect(`/checkout/payment?error=${encodeURIComponent(message)}`);
  }

  // The order is recorded; the cart and the address have done their job.
  await writeCart([]);
  await writeCheckoutDetails(null);

  redirect(`/checkout/confirmation?order=${encodeURIComponent(orderNumber)}`);
}
