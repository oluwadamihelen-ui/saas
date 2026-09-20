"use server";

import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { grantViewAsStudent, clearViewAsGrant, isAuthorizedToViewStudent } from "@/lib/services/view-as";

/// Grants a 30-minute, read-only view of a student's portal to the
/// current viewer (school owner, head of school, or a guardian of that
/// specific child — see isAuthorizedToViewStudent) without touching their
/// own session at all: this sets a separate signed cookie the portal
/// pages check, so the viewer stays logged in as themselves the entire
/// time and nothing here can be used to act as the student.
export async function viewAsStudentAction(studentId: string): Promise<void> {
  const user = await requireSchoolUser();
  const authorized = await isAuthorizedToViewStudent(user.schoolId, user, studentId);
  if (!authorized) throw new Error("You don't have access to this student's portal.");

  await grantViewAsStudent(user.id, studentId);
  redirect("/portal/student");
}

export async function exitViewAsAction(): Promise<void> {
  const user = await requireSchoolUser();
  await clearViewAsGrant();
  redirect(user.role === "PARENT" ? "/portal/parent" : "/dashboard/students");
}
