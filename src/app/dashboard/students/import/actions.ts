"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { parseStudentImportCsv, commitStudentImport } from "@/lib/services/student-import";
import type { StudentInput } from "@/lib/services/students";
import { logAudit } from "@/lib/audit";
import { recordImportBatch } from "@/lib/services/import-history";

export interface StudentImportPreviewState {
  status: "idle" | "error" | "previewed";
  message?: string;
  rows?: { rowNumber: number; label: string; errors: string[]; valid: boolean }[];
  validRowsJson?: string;
  fileName?: string;
}

export async function previewStudentImportAction(
  _prev: StudentImportPreviewState,
  formData: FormData
): Promise<StudentImportPreviewState> {
  const user = await requirePermission(PERMISSIONS.STUDENTS_CREATE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to upload." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { status: "error", message: "File is too large (max 2MB)." };
  }

  const text = await file.text();
  const { rows } = await parseStudentImportCsv(user.schoolId, text);
  if (rows.length === 0) {
    return { status: "error", message: "No rows found in the file." };
  }

  const validRows = rows
    .filter((r) => r.data)
    .map((r) => ({ rowNumber: r.rowNumber, data: r.data! }));

  return {
    status: "previewed",
    rows: rows.map((r) => ({
      rowNumber: r.rowNumber,
      label: `${r.raw.firstname || "(missing first name)"} ${r.raw.lastname || ""}`.trim(),
      errors: r.errors,
      valid: r.data !== null,
    })),
    validRowsJson: JSON.stringify(validRows),
    fileName: file.name,
  };
}

export interface StudentImportConfirmState {
  status: "idle" | "error" | "done";
  message?: string;
  created?: number;
  failed?: { rowNumber: number; name: string; error: string }[];
}

export async function confirmStudentImportAction(
  _prev: StudentImportConfirmState,
  formData: FormData
): Promise<StudentImportConfirmState> {
  const user = await requirePermission(PERMISSIONS.STUDENTS_CREATE);

  const raw = formData.get("validRowsJson");
  if (typeof raw !== "string" || !raw) {
    return { status: "error", message: "Nothing to import — run the preview again." };
  }
  const fileName = String(formData.get("fileName") || "students.csv");

  let rows: { rowNumber: number; data: StudentInput }[];
  try {
    rows = JSON.parse(raw, (key, value) => (key === "dateOfBirth" && value ? new Date(value) : value));
  } catch {
    return { status: "error", message: "Could not read the previewed rows — run the preview again." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "error", message: "There are no valid rows to import." };
  }

  const outcome = await commitStudentImport(user.schoolId, rows);

  if (outcome.created > 0) {
    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: "students.imported",
      resourceType: "Student",
      resourceId: "bulk",
      newValue: { created: outcome.created, failed: outcome.failed.length },
    });
  }

  await recordImportBatch(user.schoolId, user.id, {
    dataType: "STUDENTS",
    status: outcome.created > 0 ? "COMPLETED" : "FAILED",
    fileName,
    totalRows: rows.length,
    successCount: outcome.created,
    failedCount: outcome.failed.length,
    rowErrors: outcome.failed.map((f) => ({ rowNumber: f.rowNumber, error: `${f.name}: ${f.error}` })),
  });

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/data/history");
  return { status: "done", created: outcome.created, failed: outcome.failed };
}
