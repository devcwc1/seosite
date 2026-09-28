"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createPageAction, updatePageAction } from "@/app/(protected)/pages/actions";
import {
  SeoMetaFields,
  seoMetaFromStored,
  seoMetaPayload,
  type SeoMetaValue,
} from "@/components/seo/seo-meta-fields";
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { PageFormPayload } from "@/lib/pages/validation";

/** Kept local so zod stays server-side, matching the other forms. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type PageFormInitial = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  content: string;
  ogImageUrl: string;
  meta: {
    title?: string;
    description?: string;
    keywords?: string;
    ogImageAssetId?: string;
    noindex?: boolean;
    canonicalUrl?: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-sm">{message}</p>;
}

export function PageForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: PageFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // On an existing page the slug is a live URL, so it is never rewritten from
  // the title behind the editor's back.
  const [slugEdited, setSlugEdited] = useState(mode === "edit");

  const [values, setValues] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    status: initial?.status ?? ("draft" as PageFormPayload["status"]),
    content: initial?.content ?? "",
  });
  const [seo, setSeo] = useState<SeoMetaValue>(() =>
    seoMetaFromStored(initial?.meta, initial?.ogImageUrl),
  );

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload: PageFormPayload = {
      title: values.title,
      slug: values.slug,
      status: values.status,
      content: values.content,
      meta: seoMetaPayload(seo),
    };

    startTransition(async () => {
      setErrors({});
      setFormError(null);

      const result =
        mode === "create"
          ? await createPageAction(payload)
          : await updatePageAction(initial!.id, payload);

      if (result.ok) {
        router.push("/pages");
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
        <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">
          {formError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Page</CardTitle>
          <CardDescription>
            The slug is the page&apos;s URL. Changing it on a published page
            moves that page.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={values.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setValues((prev) => ({
                    ...prev,
                    title,
                    slug: slugEdited ? prev.slug : slugify(title),
                  }));
                }}
              />
              <FieldError message={errors.title} />
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
              <p className="text-muted-foreground text-xs">/{values.slug || "…"}</p>
              <FieldError message={errors.slug} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={values.status}
                onChange={(e) => set("status", e.target.value as PageFormPayload["status"])}
                className="focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <FieldError message={errors.status} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Content</Label>
            <RichTextEditor
              value={values.content}
              onChange={(html) => set("content", html)}
              ariaLabel="Page content"
            />
            <p className="text-muted-foreground text-xs">
              The page body. Headings, lists, quotes and links are kept; use{" "}
              <span className="font-medium">HTML</span> to paste or edit markup
              directly.
            </p>
            <FieldError message={errors.content} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search &amp; social</CardTitle>
          <CardDescription>
            How this page appears in search results and when it is shared. Leave
            fields blank to use the title.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeoMetaFields
            idPrefix="page-seo"
            value={seo}
            onChange={(patch) => setSeo((prev) => ({ ...prev, ...patch }))}
            errors={errors}
            path={`/${values.slug || "…"}`}
            fallbackTitle={values.title}
            fallbackDescription=""
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create page" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/pages")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
