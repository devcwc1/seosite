import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format";
import { listOrders } from "@/lib/orders/mutations";
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

export default async function OrdersPage() {
  const orders = await listOrders();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} {orders.length === 1 ? "order" : "orders"} · placed
          through the storefront
        </p>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No orders yet.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/orders/${order.id}`}
                      className="hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="block">{order.shippingName}</span>
                    <span className="text-sm text-muted-foreground">
                      {order.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(order.totalCents, order.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
