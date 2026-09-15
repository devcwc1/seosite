"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import {
  createProductAction,
  updateProductAction,
} from "@/app/(protected)/products/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MediaPicker, type PickedMedia } from "@/components/media/media-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductFormPayload } from "@/lib/products/validation";

/** Derive a URL slug from a title (kept local so zod stays server-side). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ReviewDraft = {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
};

/** A category this product is filed under. */
type CategorySelection = {
  categoryId: string;
  isPrimary: boolean;
};

export type AvailableCategory = { id: string; name: string; slug: string };

type ImageDraft = {
  id: string;
  assetId: string;
  url: string;
  alt: string;
};

export type ProductFormInitial = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  status: "draft" | "published" | "archived";
  shortInfo: string;
  description: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockQuantity: number;
  images: { assetId: string; url: string; alt?: string }[];
  categories: CategorySelection[];
  meta: { title?: string; description?: string; keywords?: string };
  reviews: ReviewDraft[];
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function newReview(): ReviewDraft {
  return {
    id: crypto.randomUUID(),
    author: "",
    rating: 5,
    title: "",
    body: "",
    createdAt: new Date().toISOString(),
  };
}

export function ProductForm({
  mode,
  initial,
  availableCategories = [],
}: {
  mode: "create" | "edit";
  initial?: ProductFormInitial;
  /** Every category that exists, for the picker. */
  availableCategories?: AvailableCategory[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(mode === "edit");

  const [values, setValues] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    sku: initial?.sku ?? "",
    status: initial?.status ?? "draft",
    shortInfo: initial?.shortInfo ?? "",
    description: initial?.description ?? "",
    price: initial ? String(initial.price) : "",
    currency: initial?.currency ?? "EUR",
    inStock: initial?.inStock ?? true,
    stockQuantity: initial ? String(initial.stockQuantity) : "0",
    metaTitle: initial?.meta.title ?? "",
    metaDescription: initial?.meta.description ?? "",
    metaKeywords: initial?.meta.keywords ?? "",
  });

  const [images, setImages] = useState<ImageDraft[]>(
    initial?.images.map((image) => ({
      id: crypto.randomUUID(),
      assetId: image.assetId,
      url: image.url,
      alt: image.alt ?? "",
    })) ?? [],
  );

  const [reviews, setReviews] = useState<ReviewDraft[]>(
    initial?.reviews.map((r) => ({ ...r })) ?? [],
  );

  const [categories, setCategories] = useState<CategorySelection[]>(
    initial?.categories.map((c) => ({ ...c })) ?? [],
  );

  /** Filing under a category, or unfiling it. */
  function toggleCategory(categoryId: string) {
    setCategories((prev) => {
      const without = prev.filter((c) => c.categoryId !== categoryId);
      if (without.length !== prev.length) {
        // Removing the primary hands it to whatever is left.
        if (without.length > 0 && !without.some((c) => c.isPrimary)) {
          without[0] = { ...without[0]!, isPrimary: true };
        }
        return without;
      }
      return [...prev, { categoryId, isPrimary: prev.length === 0 }];
    });
  }

  /** Exactly one selection is primary at a time. */
  function setPrimaryCategory(categoryId: string) {
    setCategories((prev) =>
      prev.map((c) => ({ ...c, isPrimary: c.categoryId === categoryId })),
    );
  }

  function set<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onTitleChange(value: string) {
    setValues((prev) => ({
      ...prev,
      title: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }));
  }

  function updateReview(id: string, patch: Partial<ReviewDraft>) {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function updateImage(id: string, patch: Partial<ImageDraft>) {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  }

  function addImages(picked: PickedMedia[]) {
    setImages((prev) => [
      ...prev,
      ...picked.map((p) => ({
        id: crypto.randomUUID(),
        assetId: p.assetId,
        url: p.url,
        alt: p.alt,
      })),
    ]);
  }

  const reviewsError = Object.entries(errors).find(([k]) =>
    k.startsWith("reviews"),
  )?.[1];
  const imagesError = Object.entries(errors).find(([k]) =>
    k.startsWith("images"),
  )?.[1];
  const categoriesError = Object.entries(errors).find(([k]) =>
    k.startsWith("categories"),
  )?.[1];

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload: ProductFormPayload = {
      title: values.title,
      slug: values.slug,
      sku: values.sku,
      status: values.status,
      shortInfo: values.shortInfo,
      description: values.description,
      price: values.price,
      currency: values.currency,
      inStock: values.inStock,
      stockQuantity: values.stockQuantity,
      images: images.map((image) => ({
        assetId: image.assetId,
        alt: image.alt,
      })),
      categories,
      meta: {
        title: values.metaTitle,
        description: values.metaDescription,
        keywords: values.metaKeywords,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        author: r.author,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt,
      })),
    };

    startTransition(async () => {
      setErrors({});
      setFormError(null);
      const result =
        mode === "create"
          ? await createProductAction(payload)
          : await updateProductAction(initial!.id, payload);

      if (result.ok) {
        router.push("/products");
        router.refresh();
      } else {
        setErrors(result.errors);
        setFormError(result.errors.form ?? "Please fix the errors below.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* -------------------------------------------------- Basic details */}
      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
            <FieldError message={errors.title} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={values.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  set("slug", e.target.value);
                }}
              />
              <FieldError message={errors.slug} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={values.sku}
                onChange={(e) => set("sku", e.target.value)}
              />
              <FieldError message={errors.sku} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shortInfo">Short description</Label>
            <Input
              id="shortInfo"
              value={values.shortInfo}
              onChange={(e) => set("shortInfo", e.target.value)}
              placeholder="One-line summary shown on cards"
            />
            <FieldError message={errors.shortInfo} />
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <RichTextEditor
              value={values.description}
              onChange={(html) => set("description", html)}
              ariaLabel="Product description"
            />
            <p className="text-xs text-muted-foreground">
              Headings, lists and links are kept; anything else is stripped
              when the product is saved.
            </p>
            <FieldError message={errors.description} />
          </div>

          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="status">Status</Label>
            <Select
              value={values.status}
              onValueChange={(v) =>
                set("status", v as typeof values.status)
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Each category is its own archive page with its own copy and SEO.
            The primary one is the label on the product card and in the
            breadcrumb.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldError message={categoriesError} />

          {availableCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories exist yet.{" "}
              <Link href="/categories/new" className="underline">
                Create one
              </Link>{" "}
              and it will be selectable here.
            </p>
          ) : (
            <ul className="grid gap-2">
              {availableCategories.map((category) => {
                const selected = categories.find(
                  (c) => c.categoryId === category.id,
                );

                return (
                  <li
                    key={category.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <label className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={selected !== undefined}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <span>
                        <span className="font-medium">{category.name}</span>
                        <span className="ml-2 text-muted-foreground">
                          /categories/{category.slug}
                        </span>
                      </span>
                    </label>

                    {/* Primary only means something for a category the product
                        is actually filed under. */}
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="radio"
                        name="primaryCategory"
                        className="size-4 accent-primary"
                        disabled={selected === undefined}
                        checked={selected?.isPrimary ?? false}
                        onChange={() => setPrimaryCategory(category.id)}
                      />
                      Primary
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {categories.length === 0 && availableCategories.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Filed under nothing yet. The product still publishes, but it will
              not appear on any archive page.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* -------------------------------------------------------- Images */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Images</CardTitle>
            <CardDescription>
              {images.length} {images.length === 1 ? "image" : "images"} — shown
              in the order listed.
            </CardDescription>
          </div>
          <MediaPicker onAdd={addImages} />
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldError message={imagesError} />
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No images yet. Upload PNG, JPEG, WebP or AVIF (max 15 MB).
            </p>
          ) : (
            images.map((image) => (
              <div
                key={image.id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[6rem_1fr_auto] sm:items-start"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url || undefined}
                  alt={image.alt || "Product image preview"}
                  className="size-24 rounded-md border bg-muted object-cover"
                />
                <div className="grid gap-2">
                  <Label>Alt text</Label>
                  <Input
                    value={image.alt}
                    onChange={(e) =>
                      updateImage(image.id, { alt: e.target.value })
                    }
                    placeholder="Describes the image for accessibility"
                  />
                  <p className="truncate text-xs text-muted-foreground">
                    {image.url}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove image"
                  onClick={() =>
                    setImages((prev) =>
                      prev.filter((img) => img.id !== image.id),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------- Pricing and stock */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing &amp; stock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="grid gap-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
              />
              <FieldError message={errors.price} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={values.currency}
                onValueChange={(v) => set("currency", v ?? "EUR")}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="inStock"
              checked={values.inStock}
              onCheckedChange={(checked) => set("inStock", checked === true)}
            />
            <Label htmlFor="inStock">In stock</Label>
          </div>

          {values.inStock ? (
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="stockQuantity">Stock quantity</Label>
              <Input
                id="stockQuantity"
                type="number"
                min="0"
                step="1"
                value={values.stockQuantity}
                onChange={(e) => set("stockQuantity", e.target.value)}
              />
              <FieldError message={errors.stockQuantity} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* -------------------------------------------------- Meta details */}
      <Card>
        <CardHeader>
          <CardTitle>Meta details</CardTitle>
          <CardDescription>Search engine / SEO metadata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="metaTitle">Meta title</Label>
            <Input
              id="metaTitle"
              value={values.metaTitle}
              onChange={(e) => set("metaTitle", e.target.value)}
            />
            <FieldError message={errors["meta.title"]} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="metaDescription">Meta description</Label>
            <Textarea
              id="metaDescription"
              rows={3}
              value={values.metaDescription}
              onChange={(e) => set("metaDescription", e.target.value)}
            />
            <FieldError message={errors["meta.description"]} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="metaKeywords">Meta keywords</Label>
            <Input
              id="metaKeywords"
              value={values.metaKeywords}
              onChange={(e) => set("metaKeywords", e.target.value)}
              placeholder="comma, separated, keywords"
            />
            <FieldError message={errors["meta.keywords"]} />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- Reviews */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Reviews</CardTitle>
            <CardDescription>
              {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReviews((prev) => [...prev, newReview()])}
          >
            <Plus className="size-4" aria-hidden />
            Add review
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldError message={reviewsError} />
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="grid gap-3 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label>Reviewer</Label>
                    <Input
                      value={review.author}
                      onChange={(e) =>
                        updateReview(review.id, { author: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Rating</Label>
                    <Select
                      value={String(review.rating)}
                      onValueChange={(v) =>
                        updateReview(review.id, { rating: Number(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} ★
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove review"
                    onClick={() =>
                      setReviews((prev) =>
                        prev.filter((r) => r.id !== review.id),
                      )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input
                    value={review.title}
                    onChange={(e) =>
                      updateReview(review.id, { title: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Comment</Label>
                  <Textarea
                    rows={3}
                    value={review.body}
                    onChange={(e) =>
                      updateReview(review.id, { body: e.target.value })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create product"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
