"use client";

import { useState, useTransition } from "react";

import { saveSeoSettingsAction } from "@/app/(protected)/settings/actions";
import { MediaPicker } from "@/components/media/media-picker";
import { MediaThumb } from "@/components/media/media-thumb";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSeoSettings } from "@/lib/seo/site-settings";

type ImageValue = { assetId: string; url: string };

function ImageField({
  label,
  hint,
  value,
  onChange,
  disabled,
  pickerTitle,
}: {
  label: string;
  hint: string;
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  disabled: boolean;
  pickerTitle: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <p className="text-muted-foreground text-caption">{hint}</p>
      <div className="flex items-start gap-3">
        {value.assetId ? (
          <MediaThumb
            src={value.url}
            alt=""
            className="h-20 w-32 rounded-md border object-cover"
          />
        ) : null}
        {disabled ? null : (
          <div className="flex flex-col gap-2">
            <MediaPicker
              mode="single"
              title={pickerTitle}
              triggerLabel={value.assetId ? "Replace image" : "Choose image"}
              onAdd={([chosen]) =>
                chosen && onChange({ assetId: chosen.assetId, url: chosen.url })
              }
            />
            {value.assetId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ assetId: "", url: "" })}
              >
                Remove
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Site-wide search and social settings. Everything here is a fallback or a
 * switch that applies to every page, which is why the page limits editing to
 * admins and the indexing switch explains itself at length.
 */
export function SeoSettingsForm({
  initial,
  defaultOgImageUrl,
  logoUrl,
  canEdit,
}: {
  initial: SiteSeoSettings;
  defaultOgImageUrl: string;
  logoUrl: string;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const [values, setValues] = useState(initial);
  const [defaultOg, setDefaultOg] = useState<ImageValue>({
    assetId: initial.defaultOgImageAssetId,
    url: defaultOgImageUrl,
  });
  const [logo, setLogo] = useState<ImageValue>({
    assetId: initial.logoAssetId,
    url: logoUrl,
  });

  function set<K extends keyof SiteSeoSettings>(key: K, value: SiteSeoSettings[K]) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setSaved(false);

    startTransition(async () => {
      const result = await saveSeoSettingsAction({
        ...values,
        defaultOgImageAssetId: defaultOg.assetId,
        logoAssetId: logo.assetId,
      });
      if (result.ok) setSaved(true);
      else setErrors(result.errors);
    });
  }

  const disabled = !canEdit || isPending;
  const exampleTitle = values.titleTemplate.includes("%s")
    ? values.titleTemplate.split("%s").join("Orbit Mug")
    : values.titleTemplate;

  function Error({ field }: { field: keyof SiteSeoSettings | "form" }) {
    return errors[field] ? (
      <p className="text-destructive text-sm">{errors[field]}</p>
    ) : null;
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-[40rem] flex-col gap-6">
      {!values.allowIndexing ? (
        <Banner tone="warning" title="Search engines are told to stay away">
          Every page is marked noindex and robots.txt disallows the whole site.
          Nothing from this store will appear in search results while this is
          off.
        </Banner>
      ) : null}
      {values.allowIndexing && !values.siteUrl ? (
        <Banner tone="info" title="No site URL set">
          Canonical links, the sitemap and share cards need the store&apos;s
          public address. Until it is set the storefront uses its own
          configuration, which may be a development address.
        </Banner>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="seo-site-name">Site name</Label>
        <Input
          id="seo-site-name"
          value={values.siteName}
          disabled={disabled}
          onChange={(e) => set("siteName", e.target.value)}
        />
        <p className="text-muted-foreground text-caption">
          Used in share cards and as the organisation name in structured data.
        </p>
        <Error field="siteName" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="seo-title-template">Title template</Label>
        <Input
          id="seo-title-template"
          value={values.titleTemplate}
          disabled={disabled}
          aria-describedby="seo-title-template-hint"
          onChange={(e) => set("titleTemplate", e.target.value)}
        />
        <p id="seo-title-template-hint" className="text-muted-foreground text-caption">
          <code>%s</code> is replaced with the page title — e.g. “{exampleTitle}”.
          A page with its own meta title uses that title as written instead.
        </p>
        <Error field="titleTemplate" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="seo-site-url">Site URL</Label>
        <Input
          id="seo-site-url"
          type="url"
          inputMode="url"
          placeholder="https://www.example.com"
          value={values.siteUrl}
          disabled={disabled}
          onChange={(e) => set("siteUrl", e.target.value)}
        />
        <p className="text-muted-foreground text-caption">
          The storefront&apos;s public address. The base for canonical links,
          the sitemap and share links.
        </p>
        <Error field="siteUrl" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="seo-default-description">Default description</Label>
        <Textarea
          id="seo-default-description"
          rows={3}
          value={values.defaultDescription}
          disabled={disabled}
          onChange={(e) => set("defaultDescription", e.target.value)}
        />
        <p className="text-muted-foreground text-caption">
          Used on pages with no description of their own, such as the home page.{" "}
          {values.defaultDescription.length} of 160 recommended characters.
        </p>
        <Error field="defaultDescription" />
      </div>

      <ImageField
        label="Default share image"
        hint="Shown when a page with no image of its own is shared. 1200×630 works everywhere."
        value={defaultOg}
        onChange={(value) => {
          setSaved(false);
          setDefaultOg(value);
        }}
        disabled={disabled}
        pickerTitle="Choose the default share image"
      />

      <ImageField
        label="Logo"
        hint="Given to search engines as the organisation's logo. Square, at least 112×112."
        value={logo}
        onChange={(value) => {
          setSaved(false);
          setLogo(value);
        }}
        disabled={disabled}
        pickerTitle="Choose the logo"
      />

      <div className="grid gap-2">
        <Label htmlFor="seo-twitter">X / Twitter handle</Label>
        <Input
          id="seo-twitter"
          placeholder="@yourstore"
          value={values.twitterHandle}
          disabled={disabled}
          onChange={(e) => set("twitterHandle", e.target.value)}
        />
        <Error field="twitterHandle" />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="seo-allow-indexing"
          checked={values.allowIndexing}
          disabled={disabled}
          onCheckedChange={(checked) => set("allowIndexing", checked === true)}
          aria-describedby="seo-allow-indexing-hint"
          className="mt-0.5"
        />
        <div className="grid gap-1">
          <Label htmlFor="seo-allow-indexing">Allow search engines to index the store</Label>
          <p id="seo-allow-indexing-hint" className="text-muted-foreground text-caption">
            Turn off for a staging site or a store that is not ready. Search
            engines can take weeks to return after being told to stay away.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="seo-robots-extra">Additional robots.txt rules</Label>
        <Textarea
          id="seo-robots-extra"
          rows={4}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={"User-agent: GPTBot\nDisallow: /"}
          value={values.robotsExtra}
          disabled={disabled || !values.allowIndexing}
          onChange={(e) => set("robotsExtra", e.target.value)}
        />
        <p className="text-muted-foreground text-caption">
          Appended to robots.txt as written. Cart and checkout are already
          excluded.
        </p>
        <Error field="robotsExtra" />
      </div>

      <Error field="form" />

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          {saved ? (
            <p className="text-muted-foreground text-body" role="status">
              Saved. The storefront picks this up within a minute.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-body">
          Only administrators can change these settings.
        </p>
      )}
    </form>
  );
}
