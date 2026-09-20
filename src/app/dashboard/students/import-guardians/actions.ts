"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, withAuthErrors } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { parseGuardianImportCsv, commitGuardianImport } from "@/lib/services/guardian-import";
import type { GuardianRelationship } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { recordImportBatch } from "@/lib/services/import-history";

export interface GuardianImportPreviewState {
  status: "idle" | "error" | "previewed";
  message?: string;
  rows?: { rowNumber: number; label: string; errors: string[]; valid: boolean }[];
  validRowsJson?: string;
  fileName?: string;
}

export const previewGuardianImportAction = withAuthErrors(async function previewGuardianImportAction(
  _prev: GuardianImportPreviewState,
  formData: FormData
): Promise<GuardianImportPreviewState> {
  const user = await requirePermission(PERMISSIONS.GUARDIANS_MANAGE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to upload." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { status: "error", message: "File is too large (max 2MB)." };
  }

  const text = await file.text();
  const { rows } = await parseGuardianImportCsv(user.schoolId, text);
  if (rows.length === 0) {
    return { status: "error", message: "No rows found in the file." };
  }

  const validRows = rows
    .filter((r) => r.guardian && r.studentId)
    .map((r) => ({ rowNumber: r.rowNumber, studentId: r.studentId!, guardian: r.guardian! }));

  return {
    status: "previewed",
    rows: rows.map((r) => ({
      rowNumber: r.rowNumber,
      label: `${r.raw.admissionnumber || "(missing admission number)"} — ${r.raw.guardianfirstname || ""} ${r.raw.guardianlastname || ""}`.trim(),
      errors: r.errors,
      valid: r.guardian !== null && r.studentId !== null,
    })),
    validRowsJson: JSON.stringify(validRows),
    fileName: file.name,
  };
});

export interface GuardianImportConfirmState {
  status: "idle" | "error" | "done";
  message?: string;
  created?: number;
  failed?: { rowNumber: number; name: string; error: string }[];
}

export const confirmGuardianImportAction = withAuthErrors(async function confirmGuardianImportAction(
  _prev: GuardianImportConfirmState,
  formData: FormData
): Promise<GuardianImportConfirmState> {
  const user = await requirePermission(PERMISSIONS.GUARDIANS_MANAGE);

  const raw = formData.get("validRowsJson");
  if (typeof raw !== "string" || !raw) {
    return { status: "error", message: "Nothing to import — run the preview again." };
  }
  const fileName = String(formData.get("fileName") || "guardians.csv");

  let rows: { rowNumber: number; studentId: string; guardian: { firstName: string; lastName: string; phone: string; email: string | null; relationship: GuardianRelationship } }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Could not read the previewed rows — run the preview again." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "error", message: "There are no valid rows to import." };
  }

  const outcome = await commitGuardianImport(user.schoolId, rows);

  if (outcome.created > 0) {
    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: "guardians.imported",
      resourceType: "Guardian",
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
});
