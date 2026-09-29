"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createPostAction, updatePostAction } from "@/app/(protected)/blog/actions";
import { MediaPicker } from "@/components/media/media-picker";
import { MediaThumb } from "@/components/media/media-thumb";
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
import { Textarea } from "@/components/ui/textarea";
import type { PostFormPayload } from "@/lib/blog/validation";

/** Kept local so zod stays server-side, matching the other forms. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type PostFormInitial = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  excerpt: string;
  body: string;
  coverImageAssetId: string;
  coverImageUrl: string;
  publishedAt: string;
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

export function PostForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: PostFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // On an existing post the slug is a live URL, so it is never rewritten from
  // the title behind the editor's back.
  const [slugEdited, setSlugEdited] = useState(mode === "edit");

  const [values, setValues] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    status: initial?.status ?? ("draft" as PostFormPayload["status"]),
    excerpt: initial?.excerpt ?? "",
    body: initial?.body ?? "",
    publishedAt: initial?.publishedAt ?? "",
  });
  const [seo, setSeo] = useState<SeoMetaValue>(() => seoMetaFromStored(initial?.meta));
  const [cover, setCover] = useState({
    assetId: initial?.coverImageAssetId ?? "",
    url: initial?.coverImageUrl ?? "",
  });

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload: PostFormPayload = {
      title: values.title,
      slug: values.slug,
      status: values.status,
      excerpt: values.excerpt,
      body: values.body,
      coverImageAssetId: cover.assetId,
      publishedAt: values.publishedAt,
      meta: seoMetaPayload(seo),
    };

    startTransition(async () => {
      setErrors({});
      setFormError(null);

      const result =
        mode === "create"
          ? await createPostAction(payload)
          : await updatePostAction(initial!.id, payload);

      if (result.ok) {
        router.push("/blog");
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
          <CardTitle>Post</CardTitle>
          <CardDescription>
            The slug is the article&apos;s URL. Changing it on a published post
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
              <p className="text-muted-foreground text-xs">/blog/{values.slug || "…"}</p>
              <FieldError message={errors.slug} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={values.status}
                onChange={(e) => set("status", e.target.value as PostFormPayload["status"])}
                className="focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <FieldError message={errors.status} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="publishedAt">Publish date</Label>
              <Input
                id="publishedAt"
                type="date"
                value={values.publishedAt}
                onChange={(e) => set("publishedAt", e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Leave blank to stamp it automatically when first published.
              </p>
              <FieldError message={errors.publishedAt} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              rows={2}
              value={values.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              placeholder="Short summary shown on the blog index and used as the search snippet."
            />
            <FieldError message={errors.excerpt} />
          </div>

          <div className="grid gap-2">
            <Label>Cover image</Label>
            <p className="text-muted-foreground text-xs">
              Lead image for the article and its share card. Chosen from the
              media library.
            </p>
            {cover.assetId ? (
              <div className="flex items-start gap-3">
                <MediaThumb
                  src={cover.url}
                  alt=""
                  className="h-24 w-40 rounded-md border object-cover"
                />
                <div className="flex flex-col gap-2">
                  <MediaPicker
                    mode="single"
                    triggerLabel="Replace image"
                    title="Choose a cover image"
                    onAdd={([chosen]) =>
                      chosen && setCover({ assetId: chosen.assetId, url: chosen.url })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCover({ assetId: "", url: "" })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <MediaPicker
                mode="single"
                triggerLabel="Choose image"
                title="Choose a cover image"
                onAdd={([chosen]) =>
                  chosen && setCover({ assetId: chosen.assetId, url: chosen.url })
                }
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label>Body</Label>
            <RichTextEditor
              value={values.body}
              onChange={(html) => set("body", html)}
              ariaLabel="Post body"
            />
            <p className="text-muted-foreground text-xs">
              The article. Headings, lists, quotes and links are kept; use{" "}
              <span className="font-medium">HTML</span> to paste or edit markup
              directly.
            </p>
            <FieldError message={errors.body} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search &amp; social</CardTitle>
          <CardDescription>
            How this article appears in search results and when it is shared.
            Leave fields blank to use the title and excerpt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeoMetaFields
            idPrefix="post-seo"
            value={seo}
            onChange={(patch) => setSeo((prev) => ({ ...prev, ...patch }))}
            errors={errors}
            path={`/blog/${values.slug || "…"}`}
            fallbackTitle={values.title}
            fallbackDescription={values.excerpt}
            publishing={values.status === "published"}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create post" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/blog")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
