"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createTimetableSlot, deleteTimetableSlot } from "@/lib/services/timetable";
import { logAudit } from "@/lib/audit";

const dayEnum = z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]);

const schema = z.object({
  classArmId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1, "Choose a subject"),
  teacherId: z.string().trim().min(1, "Choose a teacher"),
  dayOfWeek: dayEnum,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
});

export interface SlotFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createSlotAction(_prev: SlotFormState, formData: FormData): Promise<SlotFormState> {
  const user = await requirePermission(PERMISSIONS.TIMETABLE_MANAGE);

  const parsed = schema.safeParse({
    classArmId: formData.get("classArmId"),
    subjectId: formData.get("subjectId"),
    teacherId: formData.get("teacherId"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your selections." };
  }

  try {
    const slot = await createTimetableSlot(user.schoolId, parsed.data);
    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: "timetable_slot.created",
      resourceType: "TimetableSlot",
      resourceId: slot.id,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create slot." };
  }

  revalidatePath("/dashboard/timetable");
  return { status: "success" };
}

export async function deleteSlotAction(id: string) {
  const user = await requirePermission(PERMISSIONS.TIMETABLE_MANAGE);
  await deleteTimetableSlot(user.schoolId, id);
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "timetable_slot.deleted",
    resourceType: "TimetableSlot",
    resourceId: id,
  });
  revalidatePath("/dashboard/timetable");
}
