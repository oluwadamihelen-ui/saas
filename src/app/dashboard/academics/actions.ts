"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission, requireAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createTeacherAssignment, deleteTeacherAssignment } from "@/lib/services/teacher-assignments";
import { createSubject, updateSubject } from "@/lib/services/academics";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  teacherId: z.string().trim().min(1, "Choose a teacher"),
  subjectId: z.string().trim().min(1, "Choose a subject"),
  classArmId: z.string().trim().min(1, "Choose a class"),
});

export interface TeacherAssignmentState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createTeacherAssignmentAction(
  _prev: TeacherAssignmentState,
  formData: FormData
): Promise<TeacherAssignmentState> {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);

  const parsed = schema.safeParse({
    teacherId: formData.get("teacherId"),
    subjectId: formData.get("subjectId"),
    classArmId: formData.get("classArmId"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selections." };
  }

  try {
    const assignment = await createTeacherAssignment(user.schoolId, parsed.data);
    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: "teacher_assignment.created",
      resourceType: "TeacherAssignment",
      resourceId: assignment.id,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create assignment." };
  }

  revalidatePath("/dashboard/academics");
  return { status: "success" };
}

export async function deleteTeacherAssignmentAction(id: string) {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);
  await deleteTeacherAssignment(user.schoolId, id);
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "teacher_assignment.deleted",
    resourceType: "TeacherAssignment",
    resourceId: id,
  });
  revalidatePath("/dashboard/academics");
}

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(100),
  code: z.string().trim().min(1, "Subject code is required").max(20),
});

export interface SubjectFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createSubjectAction(_prev: SubjectFormState, formData: FormData): Promise<SubjectFormState> {
  const user = await requireAnyPermission([PERMISSIONS.ACADEMICS_MANAGE, PERMISSIONS.SUBJECTS_CREATE]);

  const parsed = subjectSchema.safeParse({ name: formData.get("name"), code: formData.get("code") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the subject details." };
  }

  let subject;
  try {
    subject = await createSubject(user.schoolId, parsed.data);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create this subject." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "subject.created",
    resourceType: "Subject",
    resourceId: subject.id,
    newValue: { name: subject.name, code: subject.code },
  });

  revalidatePath("/dashboard/academics");
  revalidatePath("/dashboard/online-learning/subjects");
  return { status: "success", message: `"${subject.name}" added.` };
}

export async function updateSubjectAction(
  subjectId: string,
  _prev: SubjectFormState,
  formData: FormData
): Promise<SubjectFormState> {
  const user = await requireAnyPermission([PERMISSIONS.ACADEMICS_MANAGE, PERMISSIONS.SUBJECTS_CREATE]);

  const parsed = subjectSchema.safeParse({ name: formData.get("name"), code: formData.get("code") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the subject details." };
  }

  let subject;
  try {
    subject = await updateSubject(user.schoolId, subjectId, parsed.data);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update this subject." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "subject.updated",
    resourceType: "Subject",
    resourceId: subject.id,
    newValue: { name: subject.name, code: subject.code },
  });

  revalidatePath("/dashboard/academics");
  revalidatePath("/dashboard/online-learning/subjects");
  return { status: "success", message: `"${subject.name}" updated.` };
}
