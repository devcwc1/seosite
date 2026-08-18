import { count, eq } from "drizzle-orm";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { products, users } from "@/lib/db/schema";

export default async function DashboardPage() {
  const [prodRows, pubRows, userRows] = await Promise.all([
    db.select({ value: count() }).from(products),
    db
      .select({ value: count() })
      .from(products)
      .where(eq(products.status, "published")),
    db.select({ value: count() }).from(users),
  ]);

  const stats = [
    { label: "Products", value: prodRows[0]?.value ?? 0 },
    { label: "Published", value: pubRows[0]?.value ?? 0 },
    { label: "Users", value: userRows[0]?.value ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your Orbit content.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
