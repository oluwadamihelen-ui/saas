"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { createAssignment, gradeSubmission, getSubmissionScope } from "@/lib/services/assignments";
import { assertCanActOnAssignment } from "@/lib/services/teacher-scope";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  classArmId: z.string().trim().min(1, "Choose a class"),
  subjectId: z.string().trim().min(1, "Choose a subject"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  dueDate: z.coerce.date(),
});

export interface AssignmentFormState {
  status: "idle" | "error";
  message?: string;
}

export async function createAssignmentAction(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_MANAGE);

  const parsed = createSchema.safeParse({
    classArmId: formData.get("classArmId"),
    subjectId: formData.get("subjectId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  // classArmId/subjectId come straight from the submitted form — re-check
  // here even though the new-assignment picker only offers a teacher's own
  // assignments, since the field values are still client-controllable.
  const perms = await getUserPermissions(user.id);
  try {
    await assertCanActOnAssignment(user.schoolId, user.id, perms, parsed.data.subjectId, parsed.data.classArmId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "You are not assigned to this class." };
  }

  let assignmentId: string;
  try {
    const assignment = await createAssignment(user.schoolId, user.id, {
      classArmId: parsed.data.classArmId,
      subjectId: parsed.data.subjectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueDate: parsed.data.dueDate,
    });
    assignmentId = assignment.id;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create assignment." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "assignment.created",
    resourceType: "Assignment",
    resourceId: assignmentId,
  });

  revalidatePath("/dashboard/assignments");
  redirect(`/dashboard/assignments/${assignmentId}`);
}

const gradeSchema = z.object({
  submissionId: z.string().trim().min(1),
  status: z.enum(["SUBMITTED", "GRADED"]),
  score: z.coerce.number().int().min(0).max(1000).optional().or(z.nan()),
  feedback: z.string().trim().max(2000).optional().or(z.literal("")),
});

export interface GradeState {
  status: "idle" | "error";
  message?: string;
}

export async function gradeSubmissionAction(
  assignmentId: string,
  _prev: GradeState,
  formData: FormData
): Promise<GradeState> {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_MANAGE);

  const rawScore = formData.get("score");
  const parsed = gradeSchema.safeParse({
    submissionId: formData.get("submissionId"),
    status: formData.get("status"),
    score: rawScore ? Number(rawScore) : undefined,
    feedback: formData.get("feedback") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the grade." };
  }

  const scope = await getSubmissionScope(user.schoolId, parsed.data.submissionId);
  if (!scope) {
    return { status: "error", message: "Submission not found." };
  }
  const perms = await getUserPermissions(user.id);
  try {
    await assertCanActOnAssignment(user.schoolId, user.id, perms, scope.subjectId, scope.classArmId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "You are not assigned to this class." };
  }

  try {
    await gradeSubmission(user.schoolId, user.id, parsed.data.submissionId, {
      status: parsed.data.status,
      score: Number.isNaN(parsed.data.score) ? null : parsed.data.score,
      feedback: parsed.data.feedback || null,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save grade." };
  }

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { status: "idle" };
}
