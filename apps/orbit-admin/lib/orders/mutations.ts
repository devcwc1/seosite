import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  ordersCollection,
  type EmbeddedOrderItem,
  type OrderDoc,
} from "@/lib/db/mongo-collections";
import { productContent, products, type OrderStatus } from "@/lib/db/schema";
import { getOrderMoneySettings } from "@/lib/settings/store";

import type { OrderInput } from "./validation";

/**
 * Shipping cost and tax rate are configuration, not code: neither has a
 * defensible default, and VAT in particular is a legal figure. They come from
 * the settings store (editable in the admin), and whatever was applied is
 * stored on the order itself so history stays true.
 *
 * Orders live in MongoDB with their line items embedded. Products are still
 * read from Postgres (migration in progress) to snapshot title/price; the ids
 * stored on the order are plain strings with no foreign key either way.
 */

/* -------------------------------------------------------------------------- */
/*  App-facing shapes (flat shipping, so the admin pages are unchanged)        */
/* -------------------------------------------------------------------------- */

export type OrderRecord = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  phone: string | null;
  shippingName: string;
  shippingStreet: string;
  shippingPostcode: string;
  shippingCity: string;
  shippingCountry: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  taxRateBp: number;
  paymentMethod: string;
  createdAt: Date;
};

export type OrderLineItem = {
  id: string;
  productId: string | null;
  title: string;
  sku: string;
  slug: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type OrderWithItems = OrderRecord & { items: OrderLineItem[] };

function toOrderRecord(doc: OrderDoc): OrderRecord {
  return {
    id: doc._id,
    orderNumber: doc.orderNumber,
    status: doc.status,
    email: doc.email,
    phone: doc.phone,
    shippingName: doc.shipping.name,
    shippingStreet: doc.shipping.street,
    shippingPostcode: doc.shipping.postcode,
    shippingCity: doc.shipping.city,
    shippingCountry: doc.shipping.country,
    currency: doc.currency,
    subtotalCents: doc.subtotalCents,
    shippingCents: doc.shippingCents,
    taxCents: doc.taxCents,
    totalCents: doc.totalCents,
    taxRateBp: doc.taxRateBp,
    paymentMethod: doc.paymentMethod,
    createdAt: doc.createdAt,
  };
}

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

/** MongoDB duplicate-key error (e.g. a reused order number). */
function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
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
    return { ok: false, error: "An order cannot mix currencies." };
  }
  const currency = rows[0]?.currency ?? "EUR";

  const lines: EmbeddedOrderItem[] = input.items.map((item) => {
    const product = bySlug.get(item.slug)!;
    return {
      id: randomUUID(),
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
    const doc: OrderDoc = {
      _id: randomUUID(),
      orderNumber,
      status: "pending",
      email: input.email,
      phone: input.phone || null,
      shipping: {
        name: input.shipping.name,
        street: input.shipping.street,
        postcode: input.shipping.postcode,
        city: input.shipping.city,
        country: input.shipping.country,
      },
      currency,
      subtotalCents: subtotal,
      shippingCents: shipping,
      taxCents: tax,
      totalCents: total,
      taxRateBp: rateBp,
      paymentMethod: "none",
      items: lines,
      createdAt: new Date(),
    };

    try {
      await ordersCollection().insertOne(doc);

      await recordAudit({
        actorId: null,
        action: "order.created",
        target: `order:${doc._id}`,
        metadata: {
          orderNumber,
          totalCents: total,
          currency,
          items: lines.length,
        },
      });

      return {
        ok: true,
        order: {
          orderNumber,
          currency,
          subtotalCents: subtotal,
          shippingCents: shipping,
          taxCents: tax,
          totalCents: total,
        },
      };
    } catch (error) {
      // Two orders drawing the same number is the only retryable failure.
      if (!isDuplicateKey(error)) throw error;
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
  const order = await ordersCollection().findOne(
    { _id: id },
    { projection: { status: 1, orderNumber: 1 } },
  );
  if (!order) return { ok: false, error: "Order not found." };

  if (!NEXT_STATUSES[order.status].includes(next)) {
    return {
      ok: false,
      error: `An order that is ${order.status} cannot become ${next}.`,
    };
  }

  await ordersCollection().updateOne({ _id: id }, { $set: { status: next } });

  await recordAudit({
    actorId,
    action: "order.status_changed",
    target: `order:${id}`,
    metadata: {
      orderNumber: order.orderNumber,
      from: order.status,
      to: next,
    },
  });

  return { ok: true };
}

/** Newest first, for the admin list. */
export async function listOrders(limit = 100): Promise<OrderRecord[]> {
  const docs = await ordersCollection()
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toOrderRecord);
}

export async function getOrder(id: string): Promise<OrderWithItems | null> {
  const doc = await ordersCollection().findOne({ _id: id });
  if (!doc) return null;
  return { ...toOrderRecord(doc), items: doc.items };
}
