"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createTeacherAssignment, deleteTeacherAssignment } from "@/lib/services/teacher-assignments";
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
