import { eq } from "drizzle-orm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, pool } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { createProduct, deleteProduct } from "@/lib/products/mutations";
import { productInputSchema } from "@/lib/products/validation";

import { createOrder, NEXT_STATUSES, setOrderStatus } from "./mutations";

// A self-contained product fixture, so the test does not depend on seed data.
const suffix = Date.now().toString(36);
const slug = `status-test-${suffix}`;
let productId: string;
const created: string[] = [];

async function placeOrder() {
  const result = await createOrder({
    email: "status-test@example.com",
    shipping: {
      name: "Status Test",
      street: "Teststraat 1",
      postcode: "1234 AB",
      city: "Amsterdam",
      country: "NL",
    },
    items: [{ slug, quantity: 1 }],
  });

  if (!result.ok) throw new Error(`fixture order failed: ${result.error}`);

  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, result.order.orderNumber))
    .limit(1);

  created.push(row!.id);
  return row!.id;
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  return row?.status;
}

beforeAll(async () => {
  const result = await createProduct(
    productInputSchema.parse({
      title: `Status fixture ${suffix}`,
      slug,
      sku: `STATUS-${suffix}`.toUpperCase(),
      status: "published",
      shortInfo: "",
      description: "",
      price: "9.99",
      currency: "EUR",
      inStock: true,
      stockQuantity: "100",
      images: [],
      categories: [],
      meta: { title: "", description: "", keywords: "" },
      reviews: [],
    }),
    null,
  );
  if (!result.ok) throw new Error(`fixture product failed: ${JSON.stringify(result.errors)}`);
  productId = result.id;
});

afterAll(async () => {
  for (const id of created) {
    await db.delete(orders).where(eq(orders.id, id));
  }
  if (productId) await deleteProduct(productId, null);
  await pool.end();
});

describe("order status transitions", () => {
  it("starts pending, because nothing can confirm payment on its own", async () => {
    const id = await placeOrder();
    expect(await statusOf(id)).toBe("pending");
  });

  it("allows pending → paid", async () => {
    const id = await placeOrder();

    await expect(setOrderStatus(id, "paid", null)).resolves.toMatchObject({
      ok: true,
    });
    expect(await statusOf(id)).toBe("paid");
  });

  it("refuses to skip payment on the way to shipped", async () => {
    const id = await placeOrder();

    const result = await setOrderStatus(id, "shipped", null);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("cannot become shipped");
    expect(await statusOf(id)).toBe("pending");
  });

  it("treats shipped and cancelled as terminal", async () => {
    const id = await placeOrder();
    await setOrderStatus(id, "cancelled", null);

    // Unwinding a cancellation is a refund/restock decision, not a status flip.
    expect(NEXT_STATUSES.cancelled).toEqual([]);
    expect(NEXT_STATUSES.shipped).toEqual([]);

    const result = await setOrderStatus(id, "paid", null);
    expect(result.ok).toBe(false);
    expect(await statusOf(id)).toBe("cancelled");
  });

  it("reports a missing order rather than throwing", async () => {
    const result = await setOrderStatus(
      "00000000-0000-4000-8000-000000000000",
      "paid",
      null,
    );

    expect(result).toMatchObject({ ok: false, error: "Order not found." });
  });
});
