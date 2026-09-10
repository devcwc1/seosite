import { NextResponse } from "next/server";

import { problemFor } from "@/lib/http/problem";
import { createLogger } from "@/lib/logger";
import { createOrder } from "@/lib/orders/mutations";
import { orderInputSchema } from "@/lib/orders/validation";
import { flattenZodErrors } from "@/lib/products/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "api/v1/orders" });
const INSTANCE = "/api/v1/orders";

/**
 * Order intake for the storefront.
 *
 * This is the only write a consumer app may perform, and it is server-to-server:
 * the storefront calls it from its own server with a shared token, never from
 * the browser. Without `ORBIT_WRITE_TOKEN` configured the endpoint refuses
 * outright rather than falling open — an unauthenticated order writer on a
 * public host would be an open door.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.ORBIT_WRITE_TOKEN;
  if (!expected) {
    log.error(
      { event: "orders.token_missing" },
      "ORBIT_WRITE_TOKEN is not set; refusing order writes",
    );
    return problemFor(503, "Order intake is not configured.", {
      instance: INSTANCE,
    });
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented !== expected) {
    return problemFor(401, "A valid write token is required.", {
      instance: INSTANCE,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return problemFor(400, "Expected a JSON body.", { instance: INSTANCE });
  }

  const parsed = orderInputSchema.safeParse(payload);
  if (!parsed.success) {
    return problemFor(422, "The order could not be accepted.", {
      instance: INSTANCE,
      extensions: { errors: flattenZodErrors(parsed.error) },
    });
  }

  try {
    const result = await createOrder(parsed.data);
    if (!result.ok) {
      // The catalog moved under the customer: their cart is stale, not wrong.
      return problemFor(409, result.error, { instance: INSTANCE });
    }

    return NextResponse.json(result.order, { status: 201 });
  } catch (error) {
    log.error({ err: error, event: "orders.create_failed" }, "Order failed");
    return problemFor(500, "The order could not be recorded.", {
      instance: INSTANCE,
    });
  }
}
