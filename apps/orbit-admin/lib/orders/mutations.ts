import "server-only";

import { randomBytes } from "node:crypto";

import { desc, eq, inArray } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  orderItems,
  orders,
  productContent,
  products,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/db/schema";
import { getOrderMoneySettings } from "@/lib/settings/store";

import type { OrderInput } from "./validation";

/**
 * Shipping cost and tax rate are configuration, not code: neither has a
 * defensible default, and VAT in particular is a legal figure. They come from
 * the settings table (editable in the admin), and whatever was applied is
 * stored on the order itself so history stays true.
 */

export type CreateOrderResult =
  | {
      ok: true;
      order: {
        orderNumber: string;
        currency: string;
        subtotalCents: number;
        shippingCents: number;
        taxCents: number;
        totalCents: number;
      };
    }
  | { ok: false; error: string };

/** ORB-<year>-<6 random base36>. Collisions are caught by the unique index. */
function generateOrderNumber(): string {
  const suffix = randomBytes(4).readUInt32BE(0).toString(36).toUpperCase();
  return `ORB-${new Date().getFullYear()}-${suffix.padStart(6, "0").slice(-6)}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Record an order. Prices, currency and totals all come from the catalog;
 * the caller only chooses products and quantities.
 *
 * Stock is checked but not decremented — reserving inventory is a separate
 * decision (what happens on abandonment, on cancellation, on partial ship)
 * and guessing at it here would be worse than leaving it explicit.
 */
export async function createOrder(
  input: OrderInput,
): Promise<CreateOrderResult> {
  const slugs = [...new Set(input.items.map((item) => item.slug))];

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      priceCents: products.priceCents,
      currency: products.currency,
      inStock: products.inStock,
      stockQuantity: products.stockQuantity,
      status: products.status,
      title: productContent.title,
    })
    .from(products)
    .leftJoin(productContent, eq(productContent.id, products.currentContentId))
    .where(inArray(products.slug, slugs));

  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const missing = slugs.filter((slug) => {
    const row = bySlug.get(slug);
    return !row || row.status !== "published";
  });
  if (missing.length > 0) {
    return {
      ok: false,
      error: `These products are no longer available: ${missing.join(", ")}`,
    };
  }

  // Availability must mean the same thing here as on the storefront, where
  // `lib/storefront/mapper.ts` reports a product in stock only when the flag
  // is set *and* something is on hand.
  const unavailable = slugs.filter((slug) => {
    const row = bySlug.get(slug)!;
    return !row.inStock || row.stockQuantity <= 0;
  });
  if (unavailable.length > 0) {
    return {
      ok: false,
      error: `These products are out of stock: ${unavailable.join(", ")}`,
    };
  }

  const currencies = new Set(rows.map((row) => row.currency));
  if (currencies.size > 1) {
    return {
      ok: false,
      error: "An order cannot mix currencies.",
    };
  }
  const currency = rows[0]?.currency ?? "EUR";

  const lines = input.items.map((item) => {
    const product = bySlug.get(item.slug)!;
    return {
      productId: product.id,
      title: product.title ?? product.slug,
      sku: product.sku,
      slug: product.slug,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents: product.priceCents * item.quantity,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const { shippingCents: shipping, taxRateBp: rateBp } =
    await getOrderMoneySettings();
  const tax = Math.round(((subtotal + shipping) * rateBp) / 10_000);
  const total = subtotal + shipping + tax;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const orderNumber = generateOrderNumber();

    try {
      const created = await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber,
            email: input.email,
            phone: input.phone || null,
            shippingName: input.shipping.name,
            shippingStreet: input.shipping.street,
            shippingPostcode: input.shipping.postcode,
            shippingCity: input.shipping.city,
            shippingCountry: input.shipping.country,
            currency,
            subtotalCents: subtotal,
            shippingCents: shipping,
            taxCents: tax,
            totalCents: total,
            taxRateBp: rateBp,
          })
          .returning();
        if (!order) throw new Error("orders insert returned no row");

        await tx
          .insert(orderItems)
          .values(lines.map((line) => ({ ...line, orderId: order.id })));

        return order;
      });

      await recordAudit({
        actorId: null,
        action: "order.created",
        target: `order:${created.id}`,
        metadata: {
          orderNumber: created.orderNumber,
          totalCents: total,
          currency,
          items: lines.length,
        },
      });

      return {
        ok: true,
        order: {
          orderNumber: created.orderNumber,
          currency,
          subtotalCents: subtotal,
          shippingCents: shipping,
          taxCents: tax,
          totalCents: total,
        },
      };
    } catch (error) {
      // Two orders drawing the same number is the only retryable failure.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  return { ok: false, error: "Could not allocate an order number." };
}

/**
 * Where an order may go from where it is.
 *
 * `paid` is reachable only by hand today: no payment provider reports back, so
 * someone confirms the money arrived. `shipped` and `cancelled` are terminal —
 * unwinding either one is a business decision (refund, restock) rather than a
 * status flip, so the UI does not pretend otherwise.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: [],
  cancelled: [],
};

export type StatusChangeResult = { ok: boolean; error?: string };

export async function setOrderStatus(
  id: string,
  next: OrderStatus,
  actorId: string | null,
): Promise<StatusChangeResult> {
  const [order] = await db
    .select({ id: orders.id, status: orders.status, number: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) return { ok: false, error: "Order not found." };

  if (!NEXT_STATUSES[order.status].includes(next)) {
    return {
      ok: false,
      error: `An order that is ${order.status} cannot become ${next}.`,
    };
  }

  await db.update(orders).set({ status: next }).where(eq(orders.id, id));

  await recordAudit({
    actorId,
    action: "order.status_changed",
    target: `order:${id}`,
    metadata: {
      orderNumber: order.number,
      from: order.status,
      to: next,
    },
  });

  return { ok: true };
}

export type OrderWithItems = Order & { items: OrderItem[] };

/** Newest first, for the admin list. */
export async function listOrders(limit = 100): Promise<Order[]> {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getOrder(id: string): Promise<OrderWithItems | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  return { ...order, items };
}
