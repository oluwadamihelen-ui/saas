"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { markAttendance } from "@/lib/services/attendance";
import { logAudit } from "@/lib/audit";

const statusEnum = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);

export interface MarkAttendanceState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function markAttendanceAction(
  classArmId: string,
  date: string,
  _prev: MarkAttendanceState,
  formData: FormData
): Promise<MarkAttendanceState> {
  const user = await requirePermission(PERMISSIONS.ATTENDANCE_MARK);

  const entries: { studentId: string; status: z.infer<typeof statusEnum> }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const parsed = statusEnum.safeParse(value);
    if (!parsed.success) continue;
    entries.push({ studentId: key.slice("status_".length), status: parsed.data });
  }

  if (entries.length === 0) {
    return { status: "error", message: "No students to mark." };
  }

  try {
    await markAttendance(user.schoolId, user.id, { classArmId, date, entries });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save attendance." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "attendance.marked",
    resourceType: "AttendanceRecord",
    resourceId: `${classArmId}:${date}`,
    newValue: { count: entries.length },
  });

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard");
  return { status: "success", message: `Saved attendance for ${entries.length} student${entries.length === 1 ? "" : "s"}.` };
}
