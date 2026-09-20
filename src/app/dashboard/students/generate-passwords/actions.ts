"use server";

import { requirePermission, withAuthErrors } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { bulkGenerateStudentPasswords, type BulkPasswordMedium, type BulkPasswordResultRow } from "@/lib/services/bulk-student-accounts";

export interface GeneratePasswordsState {
  status: "idle" | "error" | "done";
  message?: string;
  results?: BulkPasswordResultRow[];
  medium?: BulkPasswordMedium;
}

export const generateStudentPasswordsAction = withAuthErrors(async function generateStudentPasswordsAction(
  _prev: GeneratePasswordsState,
  formData: FormData
): Promise<GeneratePasswordsState> {
  const user = await requirePermission(PERMISSIONS.STUDENTS_EDIT);

  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);
  if (studentIds.length === 0) return { status: "error", message: "Select at least one student, or a whole class." };

  const medium = String(formData.get("medium") || "email") as BulkPasswordMedium;
  if (medium !== "email" && medium !== "sms") return { status: "error", message: "Choose email or SMS." };

  const results = await bulkGenerateStudentPasswords(user.schoolId, user.id, studentIds, medium);
  return { status: "done", results, medium };
});
