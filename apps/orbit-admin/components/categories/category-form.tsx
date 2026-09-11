"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createCategoryAction,
  updateCategoryAction,
} from "@/app/(protected)/categories/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryFormPayload } from "@/lib/categories/validation";

/** Kept local so zod stays server-side, matching the product form. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CategoryFormInitial = {
  id: string;
  name: string;
  slug: string;
  description: string;
  position: number;
  meta: { title?: string; description?: string; keywords?: string };
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function CategoryForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: CategoryFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // On an existing category the slug is a live URL, so it is never rewritten
  // from the name behind the editor's back.
  const [slugEdited, setSlugEdited] = useState(mode === "edit");

  const [values, setValues] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    position: String(initial?.position ?? 0),
    metaTitle: initial?.meta.title ?? "",
    metaDescription: initial?.meta.description ?? "",
    metaKeywords: initial?.meta.keywords ?? "",
  });

  function set<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload: CategoryFormPayload = {
      name: values.name,
      slug: values.slug,
      description: values.description,
      position: values.position,
      meta: {
        title: values.metaTitle,
        description: values.metaDescription,
        keywords: values.metaKeywords,
      },
    };

    startTransition(async () => {
      setErrors({});
      setFormError(null);

      const result =
        mode === "create"
          ? await createCategoryAction(payload)
          : await updateCategoryAction(initial!.id, payload);

      if (result.ok) {
        router.push("/categories");
        router.refresh();
      } else {
        setErrors(result.errors);
        setFormError(result.errors.form ?? "Please fix the errors below.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {formError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            The slug is the archive page&apos;s URL. Changing it on a live
            category moves that page.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => {
                const name = e.target.value;
                setValues((prev) => ({
                  ...prev,
                  name,
                  slug: slugEdited ? prev.slug : slugify(name),
                }));
              }}
            />
            <FieldError message={errors.name} />
          </div>

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
            <p className="text-xs text-muted-foreground">
              /categories/{values.slug || "…"}
            </p>
            <FieldError message={errors.slug} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="description">Archive intro</Label>
            <Textarea
              id="description"
              rows={4}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown above the product grid on the archive page.
            </p>
            <FieldError message={errors.description} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="position">Nav position</Label>
            <Input
              id="position"
              type="number"
              min={0}
              value={values.position}
              onChange={(e) => set("position", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lower comes first; ties fall back to name.
            </p>
            <FieldError message={errors.position} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
          <CardDescription>
            Leave blank to let the storefront derive them from the name and
            intro.
          </CardDescription>
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
            />
            <FieldError message={errors["meta.keywords"]} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/categories")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
