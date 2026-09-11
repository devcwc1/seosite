import Link from "next/link";
import { Plus } from "lucide-react";

import { DeleteCategoryButton } from "@/components/categories/delete-category-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCategories } from "@/lib/categories/mutations";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"} · each one is
            an archive page on the storefront
          </p>
        </div>
        <Link href="/categories/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          New category
        </Link>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">Position</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No categories yet. Products can be published without one, but
                  they will not appear on any archive page.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/categories/${category.id}/edit`}
                      className="hover:underline"
                    >
                      {category.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    /categories/{category.slug}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {category.productCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {category.position}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/categories/${category.id}/edit`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Edit
                      </Link>
                      <DeleteCategoryButton
                        id={category.id}
                        name={category.name}
                        productCount={category.productCount}
                      />
                    </div>
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
