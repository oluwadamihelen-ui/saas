"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission, requireAnyPermission, withAuthErrors } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createTeacherAssignments, deleteTeacherAssignment } from "@/lib/services/teacher-assignments";
import { createSubject, updateSubject, createClassGroup, createClassArm, deleteClassArm, deleteClassGroup } from "@/lib/services/academics";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  teacherId: z.string().trim().min(1, "Choose a teacher"),
  subjectIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one subject"),
  classArmIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one class"),
});

export interface TeacherAssignmentState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const createTeacherAssignmentAction = withAuthErrors(async function createTeacherAssignmentAction(
  _prev: TeacherAssignmentState,
  formData: FormData
): Promise<TeacherAssignmentState> {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);

  const parsed = schema.safeParse({
    teacherId: formData.get("teacherId"),
    subjectIds: formData.getAll("subjectIds"),
    classArmIds: formData.getAll("classArmIds"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selections." };
  }

  let result;
  try {
    result = await createTeacherAssignments(user.schoolId, parsed.data);
    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: "teacher_assignment.created",
      resourceType: "TeacherAssignment",
      newValue: { teacherId: parsed.data.teacherId, subjectIds: parsed.data.subjectIds, classArmIds: parsed.data.classArmIds, created: result.created },
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create assignment." };
  }

  revalidatePath("/dashboard/academics");
  if (result.created === 0) {
    return { status: "error", message: "This teacher is already assigned to all of those subjects and classes." };
  }
  return {
    status: "success",
    message: result.skipped > 0 ? `${result.created} assignment(s) added, ${result.skipped} already existed.` : undefined,
  };
});

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

export const createSubjectAction = withAuthErrors(async function createSubjectAction(_prev: SubjectFormState, formData: FormData): Promise<SubjectFormState> {
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
});

export const updateSubjectAction = withAuthErrors(async function updateSubjectAction(
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
});

const classGroupSchema = z.object({ name: z.string().trim().min(1, "Class name is required").max(100) });

export interface ClassFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const createClassGroupAction = withAuthErrors(async function createClassGroupAction(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);

  const parsed = classGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the class name." };
  }

  let classGroup;
  try {
    classGroup = await createClassGroup(user.schoolId, parsed.data.name);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create this class." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "class.created",
    resourceType: "ClassGroup",
    resourceId: classGroup.id,
    newValue: { name: classGroup.name },
  });

  revalidatePath("/dashboard/academics");
  return { status: "success", message: `"${classGroup.name}" added.` };
});

const classArmSchema = z.object({ name: z.string().trim().min(1, "Arm name is required").max(50) });

export const createClassArmAction = withAuthErrors(async function createClassArmAction(
  classGroupId: string,
  _prev: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);

  const parsed = classArmSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the arm name." };
  }

  let classArm;
  try {
    classArm = await createClassArm(user.schoolId, classGroupId, parsed.data.name);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this class arm." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "class_arm.created",
    resourceType: "ClassArm",
    resourceId: classArm.id,
    newValue: { name: classArm.name, classGroupId },
  });

  revalidatePath("/dashboard/academics");
  return { status: "success", message: `Arm "${classArm.name}" added.` };
});

export async function deleteClassArmAction(id: string) {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);
  await deleteClassArm(user.schoolId, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "class_arm.deleted", resourceType: "ClassArm", resourceId: id });
  revalidatePath("/dashboard/academics");
}

export async function deleteClassGroupAction(id: string) {
  const user = await requirePermission(PERMISSIONS.ACADEMICS_MANAGE);
  await deleteClassGroup(user.schoolId, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "class.deleted", resourceType: "ClassGroup", resourceId: id });
  revalidatePath("/dashboard/academics");
}
