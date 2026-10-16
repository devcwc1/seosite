import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  productsCollection,
  usersCollection,
} from "@/lib/db/mongo-collections";

export default async function DashboardPage() {
  const [productCount, publishedCount, userCount] = await Promise.all([
    productsCollection().countDocuments({}),
    productsCollection().countDocuments({ status: "published" }),
    usersCollection().countDocuments({}),
  ]);

  const stats = [
    { label: "Products", value: productCount },
    { label: "Published", value: publishedCount },
    { label: "Users", value: userCount },
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
