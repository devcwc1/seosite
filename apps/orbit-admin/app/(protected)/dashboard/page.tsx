import { count } from "drizzle-orm";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { productsCollection } from "@/lib/db/mongo-collections";
import { users } from "@/lib/db/schema";

export default async function DashboardPage() {
  // Products live in Mongo; users are still Postgres (migration in progress).
  const [productCount, publishedCount, userRows] = await Promise.all([
    productsCollection().countDocuments({}),
    productsCollection().countDocuments({ status: "published" }),
    db.select({ value: count() }).from(users),
  ]);

  const stats = [
    { label: "Products", value: productCount },
    { label: "Published", value: publishedCount },
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
