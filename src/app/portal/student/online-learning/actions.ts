"use server";

import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { markLectureOpened, updateVideoProgress, markLectureCompleteManually } from "@/lib/services/lectures";

async function requireStudent() {
  const user = await requireSchoolUser();
  if (user.role !== "STUDENT") throw new Error("Only students can access this.");
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) throw new Error("Student profile not found.");
  return { schoolId: user.schoolId, studentId: student.id };
}

export async function markLectureOpenedAction(lectureId: string) {
  const { schoolId, studentId } = await requireStudent();
  await markLectureOpened(schoolId, studentId, lectureId);
}

export async function updateVideoProgressAction(lectureId: string, positionSeconds: number, durationSeconds: number) {
  const { schoolId, studentId } = await requireStudent();
  await updateVideoProgress(schoolId, studentId, lectureId, positionSeconds, durationSeconds);
  revalidatePath(`/portal/student/online-learning/lectures/${lectureId}`);
}

export async function markLectureCompleteManuallyAction(lectureId: string) {
  const { schoolId, studentId } = await requireStudent();
  await markLectureCompleteManually(schoolId, studentId, lectureId);
  revalidatePath(`/portal/student/online-learning/lectures/${lectureId}`);
}
