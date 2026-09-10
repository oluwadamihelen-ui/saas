"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { parseResultsImportCsv, commitResultsImport, type ScoreImportEntry } from "@/lib/services/results-import";
import { logAudit } from "@/lib/audit";

export interface ResultsImportPreviewState {
  status: "idle" | "error" | "previewed";
  message?: string;
  rows?: { rowNumber: number; summary: string; errors: string[]; valid: boolean }[];
  validRowsJson?: string;
}

export async function previewResultsImportAction(
  _prev: ResultsImportPreviewState,
  formData: FormData
): Promise<ResultsImportPreviewState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to upload." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { status: "error", message: "File is too large (max 2MB)." };
  }

  const text = await file.text();
  const { rows } = await parseResultsImportCsv(user.schoolId, text);
  if (rows.length === 0) {
    return { status: "error", message: "No rows found in the file." };
  }

  const validRows = rows.filter((r) => r.data).map((r) => r.data!);

  return {
    status: "previewed",
    rows: rows.map((r) => ({ rowNumber: r.rowNumber, summary: r.summary, errors: r.errors, valid: r.data !== null })),
    validRowsJson: JSON.stringify(validRows),
  };
}

export interface ResultsImportConfirmState {
  status: "idle" | "error" | "done";
  message?: string;
  imported?: number;
}

export async function confirmResultsImportAction(
  _prev: ResultsImportConfirmState,
  formData: FormData
): Promise<ResultsImportConfirmState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);

  const raw = formData.get("validRowsJson");
  if (typeof raw !== "string" || !raw) {
    return { status: "error", message: "Nothing to import — run the preview again." };
  }

  let entries: ScoreImportEntry[];
  try {
    entries = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Could not read the previewed rows — run the preview again." };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { status: "error", message: "There are no valid rows to import." };
  }

  let outcome;
  try {
    outcome = await commitResultsImport(user.schoolId, user.id, entries);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not import these scores." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "results.imported",
    resourceType: "Score",
    resourceId: "bulk",
    newValue: { imported: outcome.imported },
  });

  revalidatePath("/dashboard/results");
  return { status: "done", imported: outcome.imported };
}
