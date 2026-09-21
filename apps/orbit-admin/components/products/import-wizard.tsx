"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";

import {
  previewImportAction,
  runImportAction,
} from "@/app/(protected)/products/import/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { parseCsv } from "@/lib/products/csv";
import {
  DEFAULT_IMPORT_OPTIONS,
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
  suggestMapping,
  type ColumnMapping,
  type ImportField,
  type ImportOptions,
} from "@/lib/products/import-map";
import type { ImportPreview, ImportResult } from "@/lib/products/import";
import { cn } from "@/lib/utils";

/** Human labels for the fields, in the order they are shown. */
const FIELD_LABELS: Record<ImportField, string> = {
  title: "Name",
  sku: "SKU",
  slug: "Slug",
  shortInfo: "Short description",
  description: "Description",
  price: "Price",
  currency: "Currency",
  stockQuantity: "Stock quantity",
  inStock: "In stock",
  status: "Status",
  categories: "Categories",
  images: "Image URLs",
  metaTitle: "Meta title",
  metaDescription: "Meta description",
  metaKeywords: "Meta keywords",
};

type Step = "upload" | "map" | "preview" | "done";

type FileState = {
  name: string;
  text: string;
  headers: string[];
  /** A few data rows, for showing example values next to each column. */
  sample: string[][];
};

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<FileState | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;
    setError(null);

    const text = await chosen.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0 || rows.length === 0) {
      setError("That file has no header row or no data rows.");
      return;
    }
    setFile({ name: chosen.name, text, headers, sample: rows.slice(0, 5) });
    setMapping(suggestMapping(headers));
    setStep("map");
  }

  const missingRequired = useMemo(
    () => REQUIRED_FIELDS.filter((f) => mapping[f] === null || mapping[f] === undefined),
    [mapping],
  );

  function runPreview() {
    if (!file) return;
    setError(null);
    start(async () => {
      const res = await previewImportAction(file.text, mapping, options);
      if (res.ok) {
        setPreview(res.preview);
        setStep("preview");
      } else {
        setError(res.error);
      }
    });
  }

  function runReal() {
    if (!file) return;
    setError(null);
    start(async () => {
      const res = await runImportAction(file.text, mapping, options);
      if (res.ok) {
        setResult(res.result);
        setStep("done");
      } else {
        setError(res.error);
      }
    });
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setMapping({});
    setOptions(DEFAULT_IMPORT_OPTIONS);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  /** A sample value for a column, for the mapping preview. */
  const sampleFor = (index: number | null | undefined) => {
    if (index === null || index === undefined || !file) return "";
    const first = file.sample.find((r) => (r[index] ?? "").trim() !== "");
    return (first?.[index] ?? "").slice(0, 60);
  };

  return (
    <div className="flex flex-col gap-6">
      <Steps current={step} />

      {error ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-body font-medium">Choose a CSV or tab-separated file</p>
          <p className="text-muted-foreground text-body">
            A WooCommerce or Shopify export, or any file with a header row.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            aria-label="Import file"
            className="hidden"
            onChange={(e) => void onFile(e.target.files)}
          />
          <Button type="button" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden />
            Choose file
          </Button>
        </div>
      ) : null}

      {step === "map" && file ? (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-body">
              <span className="font-medium">{file.name}</span> — {file.headers.length} columns.
              Match each Orbit field to a column. Name and SKU are required; the
              rest are optional.
            </p>
          </div>

          <div className="grid gap-3">
            {IMPORT_FIELDS.map((field) => {
              const index = mapping[field] ?? null;
              const required = REQUIRED_FIELDS.includes(field);
              const unmapped = index === null;
              return (
                <div key={field} className="grid grid-cols-[10rem_1fr] items-center gap-3">
                  <Label htmlFor={`map-${field}`} className="text-body">
                    {FIELD_LABELS[field]}
                    {required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <div className="flex items-center gap-3">
                    <select
                      id={`map-${field}`}
                      value={index === null ? "" : String(index)}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [field]: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                      aria-invalid={required && unmapped}
                      className={cn(
                        "focus-visible:ring-ring/50 h-9 w-full max-w-[22rem] rounded-md border bg-transparent px-2 text-body outline-none focus-visible:ring-[3px]",
                        required && unmapped && "border-destructive",
                      )}
                    >
                      <option value="">— not mapped —</option>
                      {file.headers.map((header, i) => (
                        <option key={i} value={i}>
                          {header || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                    <span className="text-muted-foreground text-caption truncate">
                      {sampleFor(index)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <fieldset className="grid gap-3 rounded-lg border p-4">
            <legend className="text-caption text-muted-foreground px-1">Options</legend>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-body">
                Default status
                <select
                  value={options.defaultStatus}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, defaultStatus: e.target.value as ImportOptions["defaultStatus"] }))
                  }
                  className="h-9 rounded-md border bg-transparent px-2 text-body outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-body">
                Default currency
                <input
                  value={options.defaultCurrency}
                  onChange={(e) => setOptions((o) => ({ ...o, defaultCurrency: e.target.value }))}
                  maxLength={3}
                  className="h-9 w-16 rounded-md border bg-transparent px-2 text-center text-body uppercase outline-none"
                />
              </label>
            </div>

            <label className="flex items-start gap-2">
              <Checkbox
                checked={options.updateExisting}
                onCheckedChange={(c) => setOptions((o) => ({ ...o, updateExisting: c === true }))}
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="text-body">Update products that already exist</span>
                <span className="text-muted-foreground text-caption">
                  Matched by SKU. Off means a matching SKU is skipped, not changed.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <Checkbox
                checked={options.importImages}
                onCheckedChange={(c) => setOptions((o) => ({ ...o, importImages: c === true }))}
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="text-body">Fetch images from the mapped URL column</span>
                <span className="text-muted-foreground text-caption">
                  Each image is downloaded and re-encoded through the media
                  library. Slower — leave off for a first run.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={runPreview} disabled={pending || missingRequired.length > 0}>
              {pending ? "Checking…" : "Preview"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Start over
            </Button>
            {missingRequired.length > 0 ? (
              <span className="text-muted-foreground text-caption">
                Map {missingRequired.map((f) => FIELD_LABELS[f]).join(" and ")} to continue.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="To create" value={preview.toCreate} tone="success" />
            <Stat label="To update" value={preview.toUpdate} tone="info" />
            <Stat
              label={options.updateExisting ? "Conflicts" : "Will skip"}
              value={preview.conflicts}
              tone={preview.conflicts > 0 ? "warning" : "neutral"}
            />
            <Stat label="Invalid" value={preview.invalid} tone={preview.invalid > 0 ? "danger" : "neutral"} />
          </div>

          <ul className="text-muted-foreground text-body flex flex-col gap-1">
            {preview.newCategories.length > 0 ? (
              <li>
                <span className="text-foreground font-medium">
                  {preview.newCategories.length} new{" "}
                  {preview.newCategories.length === 1 ? "category" : "categories"}
                </span>{" "}
                will be created: {preview.newCategories.slice(0, 8).join(", ")}
                {preview.newCategories.length > 8 ? "…" : ""}
              </li>
            ) : null}
            {preview.imageCount > 0 && options.importImages ? (
              <li>{preview.imageCount} images will be fetched.</li>
            ) : null}
            {preview.duplicateSkus.length > 0 ? (
              <li className="text-status-warning-foreground">
                {preview.duplicateSkus.length} SKU
                {preview.duplicateSkus.length === 1 ? "" : "s"} appear more than once in the file.
              </li>
            ) : null}
          </ul>

          <PreviewTable preview={preview} />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={runReal}
              disabled={pending || preview.toCreate + preview.toUpdate === 0}
            >
              {pending
                ? "Importing…"
                : `Import ${preview.toCreate + preview.toUpdate} product${
                    preview.toCreate + preview.toUpdate === 1 ? "" : "s"
                  }`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("map")}>
              Back to mapping
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Created" value={result.created} tone="success" />
            <Stat label="Updated" value={result.updated} tone="info" />
            <Stat label="Skipped" value={result.skipped} tone="neutral" />
            <Stat label="Failed" value={result.failed} tone={result.failed > 0 ? "danger" : "neutral"} />
          </div>

          <ul className="text-muted-foreground text-body flex flex-col gap-1">
            {result.categoriesCreated > 0 ? <li>{result.categoriesCreated} categories created.</li> : null}
            {result.imagesImported > 0 ? <li>{result.imagesImported} images imported.</li> : null}
            {result.imagesFailed > 0 ? (
              <li className="text-status-warning-foreground">{result.imagesFailed} images could not be fetched.</li>
            ) : null}
          </ul>

          {result.failed > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-section-title">What failed</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-body">
                  <thead className="bg-muted/40 text-caption text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Line</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.outcomes
                      .filter((o) => o.action === "failed")
                      .slice(0, 200)
                      .map((o, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 tabular-nums">{o.line}</td>
                          <td className="px-3 py-2">{o.sku || "—"}</td>
                          <td className="text-muted-foreground px-3 py-2">{o.message}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Link href="/products" className="text-body underline">
              Go to products
            </Link>
            <Button type="button" variant="ghost" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["upload", "map", "preview", "done"];
  const labels: Record<Step, string> = {
    upload: "Upload",
    map: "Map columns",
    preview: "Preview",
    done: "Done",
  };
  const currentIndex = order.indexOf(current);
  return (
    <ol className="text-caption flex items-center gap-2">
      {order.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              i === currentIndex
                ? "bg-primary text-primary-foreground"
                : i < currentIndex
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {labels[s]}
          </span>
          {i < order.length - 1 ? <span className="text-muted-foreground">→</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    success: "text-status-success-foreground",
    info: "text-status-info-foreground",
    warning: "text-status-warning-foreground",
    danger: "text-status-danger-foreground",
    neutral: "text-foreground",
  }[tone];
  return (
    <div className="rounded-lg border p-3">
      <p className={cn("text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      <p className="text-caption text-muted-foreground">{label}</p>
    </div>
  );
}

function PreviewTable({ preview }: { preview: ImportPreview }) {
  // Invalid rows first — they are the ones that need attention.
  const rows = [...preview.rows].sort((a, b) => {
    const rank = (x: string) => (x === "invalid" ? 0 : x === "conflict" ? 1 : 2);
    return rank(a.action) - rank(b.action) || a.line - b.line;
  });

  return (
    <div className="max-h-[24rem] overflow-auto rounded-lg border">
      <table className="w-full text-left text-body">
        <thead className="bg-muted/40 text-caption text-muted-foreground sticky top-0">
          <tr>
            <th className="px-3 py-2">Line</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2 tabular-nums">{r.line}</td>
              <td className="px-3 py-2">{r.sku || "—"}</td>
              <td className="px-3 py-2">{r.title || "—"}</td>
              <td className="px-3 py-2 capitalize">{r.action}</td>
              <td className="text-muted-foreground px-3 py-2">
                {r.issues?.map((issue) => issue.message).join(" ") ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
