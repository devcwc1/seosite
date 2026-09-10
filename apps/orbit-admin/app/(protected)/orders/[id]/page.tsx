import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { formatPrice } from "@/lib/format";
import { getOrder, NEXT_STATUSES } from "@/lib/orders/mutations";
import type { OrderStatus } from "@/lib/db/schema";

const STATUS_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  paid: "default",
  shipped: "outline",
  cancelled: "destructive",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const money = (cents: number) => formatPrice(cents, order.currency);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {order.orderNumber}
            </h1>
            <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Placed {order.createdAt.toLocaleString()}
          </p>
        </div>
        <Link href="/orders" className="text-sm hover:underline">
          ← All orders
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
          <CardDescription>
            Captured at checkout; the storefront has no accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Contact</p>
            <p>{order.email}</p>
            {order.phone ? <p>{order.phone}</p> : null}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ship to</p>
            <p>{order.shippingName}</p>
            <p>{order.shippingStreet}</p>
            <p>
              {order.shippingPostcode} {order.shippingCity}
            </p>
            <p>{order.shippingCountry}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Titles and prices as they were when the order was placed — later
            catalog edits never rewrite an order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(item.unitPriceCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(item.lineTotalCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{money(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">{money(order.shippingCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                VAT ({(order.taxRateBp / 100).toFixed(2)}%)
              </dt>
              <dd className="tabular-nums">{money(order.taxCents)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(order.totalCents)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment &amp; fulfilment</CardTitle>
          <CardDescription>
            Method recorded as <code>{order.paymentMethod}</code>. No payment
            provider is integrated, so nothing has been charged automatically —
            confirm the money yourself before marking this order paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OrderStatusActions
            orderId={order.id}
            next={NEXT_STATUSES[order.status]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
