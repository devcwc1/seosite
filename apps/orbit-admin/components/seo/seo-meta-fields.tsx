"use client";

import { MediaPicker } from "@/components/media/media-picker";
import { MediaThumb } from "@/components/media/media-thumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * The per-page SEO fields, shared by the product and category forms.
 *
 * One component because the two forms edit one shape (lib/seo/meta.ts) that
 * the storefront renders one way. Two copies of this UI would drift the way
 * two copies of the schema would.
 *
 * Lengths are guidance, not limits. A search engine truncates a long title in
 * its results; it does not reject the page. So the counters warn past the
 * recommended length instead of stopping the editor typing.
 */

const TITLE_RECOMMENDED = 60;
const DESCRIPTION_RECOMMENDED = 160;

export type SeoMetaValue = {
  title: string;
  description: string;
  keywords: string;
  ogImageAssetId: string;
  /** Display only — the id is what is saved. */
  ogImageUrl: string;
  noindex: boolean;
  canonicalUrl: string;
};

export function seoMetaFromStored(
  meta:
    | {
        title?: string;
        description?: string;
        keywords?: string;
        ogImageAssetId?: string;
        noindex?: boolean;
        canonicalUrl?: string;
      }
    | undefined,
  ogImageUrl?: string,
): SeoMetaValue {
  return {
    title: meta?.title ?? "",
    description: meta?.description ?? "",
    keywords: meta?.keywords ?? "",
    ogImageAssetId: meta?.ogImageAssetId ?? "",
    ogImageUrl: ogImageUrl ?? "",
    noindex: meta?.noindex === true,
    canonicalUrl: meta?.canonicalUrl ?? "",
  };
}

/** The payload shape both actions validate with seoMetaInputSchema. */
export function seoMetaPayload(value: SeoMetaValue) {
  return {
    title: value.title,
    description: value.description,
    keywords: value.keywords,
    ogImageAssetId: value.ogImageAssetId,
    noindex: value.noindex,
    canonicalUrl: value.canonicalUrl,
  };
}

function LengthHint({
  id,
  length,
  recommended,
}: {
  id: string;
  length: number;
  recommended: number;
}) {
  const over = length > recommended;
  return (
    <p
      id={id}
      className={cn(
        "text-caption tabular-nums",
        over ? "text-status-warning-foreground" : "text-muted-foreground",
      )}
    >
      {length} of {recommended} recommended characters
      {over ? " — search results will cut this short" : ""}
    </p>
  );
}

export function SeoMetaFields({
  idPrefix,
  value,
  onChange,
  errors,
  path,
  fallbackTitle,
  fallbackDescription,
}: {
  /** Keeps ids unique if two sets ever share a page. */
  idPrefix: string;
  value: SeoMetaValue;
  onChange: (patch: Partial<SeoMetaValue>) => void;
  /** Keyed like the server's errors: "meta.title", "meta.canonicalUrl"… */
  errors: Record<string, string>;
  /** The page's own path on the storefront, e.g. /products/orbit-mug. */
  path: string;
  /** What the storefront shows when the editor leaves the field blank. */
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const previewTitle = value.title || fallbackTitle || "Untitled";
  const previewDescription =
    value.description || fallbackDescription || "No description yet.";

  function Error({ field }: { field: string }) {
    const message = errors[`meta.${field}`];
    return message ? <p className="text-destructive text-sm">{message}</p> : null;
  }

  return (
    <div className="grid gap-5">
      {/*
        A preview of the search result. It is approximate by nature — engines
        rewrite titles and snippets as they see fit — but it shows what the
        storefront will actually send, including the fallbacks.
      */}
      <div
        aria-label="Search result preview"
        role="group"
        className="bg-muted/30 rounded-lg border p-4"
      >
        <p className="text-caption text-muted-foreground">Search preview</p>
        <p className="text-caption text-muted-foreground mt-2 truncate">{path}</p>
        <p className="text-status-info-foreground truncate text-[1.05rem] leading-snug">
          {previewTitle}
        </p>
        <p className="text-muted-foreground text-body line-clamp-2">
          {previewDescription}
        </p>
        {value.noindex ? (
          <p className="text-status-warning-foreground text-caption mt-2 font-medium">
            Hidden from search engines — this page will not appear in results.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id("title")}>Meta title</Label>
        <Input
          id={id("title")}
          value={value.title}
          placeholder={fallbackTitle}
          aria-describedby={id("title-hint")}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <LengthHint
          id={id("title-hint")}
          length={(value.title || fallbackTitle).length}
          recommended={TITLE_RECOMMENDED}
        />
        <Error field="title" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id("description")}>Meta description</Label>
        <Textarea
          id={id("description")}
          rows={3}
          value={value.description}
          placeholder={fallbackDescription}
          aria-describedby={id("description-hint")}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <LengthHint
          id={id("description-hint")}
          length={value.description.length}
          recommended={DESCRIPTION_RECOMMENDED}
        />
        <Error field="description" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id("keywords")}>Meta keywords</Label>
        <Input
          id={id("keywords")}
          value={value.keywords}
          placeholder="comma, separated, keywords"
          onChange={(e) => onChange({ keywords: e.target.value })}
        />
        <p className="text-muted-foreground text-caption">
          Major search engines ignore this tag; it is kept for tools that read it.
        </p>
        <Error field="keywords" />
      </div>

      {/*
        The asset id is what is stored, not a URL, so the image stays a library
        asset: it counts toward usage, and the library refuses to delete it
        while this page points at it.
      */}
      <div className="grid gap-2">
        <Label>Social share image</Label>
        <p className="text-muted-foreground text-caption">
          Shown when the page is shared. Without one, the storefront uses the
          page&apos;s first image, then the site-wide default. 1200×630 works
          everywhere.
        </p>
        {value.ogImageAssetId ? (
          <div className="flex items-start gap-3">
            <MediaThumb
              src={value.ogImageUrl}
              alt=""
              className="h-20 w-32 rounded-md border object-cover"
            />
            <div className="flex flex-col gap-2">
              <MediaPicker
                mode="single"
                triggerLabel="Replace image"
                title="Choose a social share image"
                onAdd={([chosen]) =>
                  chosen &&
                  onChange({ ogImageAssetId: chosen.assetId, ogImageUrl: chosen.url })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ogImageAssetId: "", ogImageUrl: "" })}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <MediaPicker
              mode="single"
              triggerLabel="Choose image"
              title="Choose a social share image"
              onAdd={([chosen]) =>
                chosen &&
                onChange({ ogImageAssetId: chosen.assetId, ogImageUrl: chosen.url })
              }
            />
          </div>
        )}
        <Error field="ogImageAssetId" />
      </div>

      <div className="grid gap-2">
        <div className="flex items-start gap-2">
          <Checkbox
            id={id("noindex")}
            checked={value.noindex}
            onCheckedChange={(checked) => onChange({ noindex: checked === true })}
            aria-describedby={id("noindex-hint")}
            className="mt-0.5"
          />
          <div className="grid gap-1">
            <Label htmlFor={id("noindex")}>Hide from search engines</Label>
            <p id={id("noindex-hint")} className="text-muted-foreground text-caption">
              Adds noindex and leaves the page out of the sitemap. The page
              stays reachable for anyone with the link.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={id("canonical")}>Canonical URL</Label>
        <Input
          id={id("canonical")}
          type="url"
          inputMode="url"
          value={value.canonicalUrl}
          placeholder="Leave blank — this page is the original"
          aria-describedby={id("canonical-hint")}
          onChange={(e) => onChange({ canonicalUrl: e.target.value })}
        />
        <p id={id("canonical-hint")} className="text-muted-foreground text-caption">
          Only set this when the same content lives at another URL that should
          rank instead. A wrong value can remove this page from search results.
        </p>
        <Error field="canonicalUrl" />
      </div>
    </div>
  );
}
