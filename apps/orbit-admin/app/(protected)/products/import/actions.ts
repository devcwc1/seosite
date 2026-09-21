"use server";

import { getCurrentSession, isWriter } from "@/lib/auth/session";
import {
  previewImport,
  runImport,
  type ImportPreview,
  type ImportResult,
} from "@/lib/products/import";
import type { ColumnMapping, ImportOptions } from "@/lib/products/import-map";

/**
 * Importing is bulk product editing, so it sits with the same writer check as
 * editing a single product. The heavy lifting — parsing, validation, the
 * create/update — lives in lib/products/import; these actions only guard it.
 */

export type PreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string };

export async function previewImportAction(
  fileText: string,
  mapping: ColumnMapping,
  options: ImportOptions,
): Promise<PreviewResult> {
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) {
    return { ok: false, error: "You do not have permission to import products." };
  }

  try {
    return { ok: true, preview: await previewImport(fileText, mapping, options) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read the file.",
    };
  }
}

export type RunResult =
  | { ok: true; result: ImportResult }
  | { ok: false; error: string };

export async function runImportAction(
  fileText: string,
  mapping: ColumnMapping,
  options: ImportOptions,
): Promise<RunResult> {
  const session = await getCurrentSession();
  if (!session || !isWriter(session.user)) {
    return { ok: false, error: "You do not have permission to import products." };
  }

  try {
    return { ok: true, result: await runImport(fileText, mapping, options, session.user.id) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The import could not be completed.",
    };
  }
}
