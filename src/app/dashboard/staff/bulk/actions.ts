"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  parseStaffImportCsv,
  validateStaffImportRows,
  commitStaffImport,
  type StaffImportData,
  type StaffImportRawRow,
} from "@/lib/services/staff-import";
import { recordImportBatch } from "@/lib/services/import-history";

export interface StaffBulkPreviewState {
  status: "idle" | "error" | "previewed";
  message?: string;
  rows?: { rowNumber: number; summary: string; errors: string[]; valid: boolean }[];
  validRowsJson?: string;
  fileName?: string;
  total?: number;
  validCount?: number;
  invalidCount?: number;
}

const manualRowSchema = z.object({
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  role: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  staffid: z.string().optional().default(""),
  jobtitle: z.string().optional().default(""),
  department: z.string().optional().default(""),
});

export async function previewStaffBulkAction(_prev: StaffBulkPreviewState, formData: FormData): Promise<StaffBulkPreviewState> {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);
  const method = String(formData.get("method") || "MANUAL");

  let rawRows: StaffImportRawRow[];
  let fileName: string;

  if (method === "CSV") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Choose a CSV file to upload." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { status: "error", message: "File is too large (max 2MB)." };
    }
    const text = await file.text();
    rawRows = parseStaffImportCsv(text);
    fileName = file.name;
  } else {
    const raw = formData.get("rowsJson");
    if (typeof raw !== "string" || !raw) {
      return { status: "error", message: "Add at least one row." };
    }
    let parsedRows: unknown;
    try {
      parsedRows = JSON.parse(raw);
    } catch {
      return { status: "error", message: "Could not read the entered rows." };
    }
    if (!Array.isArray(parsedRows)) {
      return { status: "error", message: "Could not read the entered rows." };
    }
    rawRows = parsedRows.map((row, i) => {
      const parsed = manualRowSchema.safeParse(row);
      return { rowNumber: i + 1, raw: parsed.success ? parsed.data : {} };
    });
    fileName = "manual-entry.csv";
  }

  if (rawRows.length === 0) {
    return { status: "error", message: "No rows found." };
  }
  if (rawRows.length > 500) {
    return { status: "error", message: "Too many rows in one batch (max 500) — split into smaller files." };
  }

  const { rows } = await validateStaffImportRows(user.schoolId, rawRows);
  const validRows = rows.filter((r) => r.data).map((r) => ({ rowNumber: r.rowNumber, data: r.data! }));

  return {
    status: "previewed",
    rows: rows.map((r) => ({
      rowNumber: r.rowNumber,
      summary: `${r.raw.name || "(no name)"} — ${r.raw.email || "(no email)"} — ${r.raw.role || "(no role)"}`,
      errors: r.errors,
      valid: r.data !== null,
    })),
    validRowsJson: JSON.stringify(validRows),
    fileName,
    total: rows.length,
    validCount: validRows.length,
    invalidCount: rows.length - validRows.length,
  };
}

export interface StaffBulkConfirmState {
  status: "idle" | "error" | "done";
  message?: string;
  created?: number;
  failed?: { rowNumber: number; name: string; error: string }[];
  results?: { name: string; email: string; inviteToken: string }[];
  mode?: "INVITE" | "DIRECT";
}

export async function confirmStaffBulkAction(_prev: StaffBulkConfirmState, formData: FormData): Promise<StaffBulkConfirmState> {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);

  const mode = formData.get("mode") === "DIRECT" ? "DIRECT" : "INVITE";
  const fileName = String(formData.get("fileName") || "staff.csv");
  const raw = formData.get("validRowsJson");
  if (typeof raw !== "string" || !raw) {
    return { status: "error", message: "Nothing to create — run the preview again." };
  }

  let rows: { rowNumber: number; data: StaffImportData }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Could not read the previewed rows — run the preview again." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "error", message: "There are no valid rows to create." };
  }

  const outcome = await commitStaffImport(user.schoolId, user.id, rows, mode);

  await recordImportBatch(user.schoolId, user.id, {
    dataType: "STAFF",
    status: outcome.created > 0 ? "COMPLETED" : "FAILED",
    fileName,
    totalRows: rows.length,
    successCount: outcome.created,
    failedCount: outcome.failed.length,
    rowErrors: outcome.failed.map((f) => ({ rowNumber: f.rowNumber, error: `${f.name}: ${f.error}` })),
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/administration/users");
  revalidatePath("/dashboard/data/history");

  return { status: "done", created: outcome.created, failed: outcome.failed, results: outcome.results, mode };
}
