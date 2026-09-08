"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/services/calendar";
import { logAudit } from "@/lib/audit";

export interface CalendarFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const eventSchema = z.object({
  title: z.string().trim().min(1, "Enter an event/activity name"),
  description: z.string().trim().optional().or(z.literal("")),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  classArmId: z.string().trim().optional().or(z.literal("")),
  termId: z.string().trim().optional().or(z.literal("")),
  notifyAudience: z.enum(["PARENTS", "STAFF", "BOTH", ""]).optional(),
});

export async function createEventAction(_prev: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const user = await requirePermission(PERMISSIONS.CALENDAR_MANAGE);
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    classArmId: formData.get("classArmId") ?? "",
    termId: formData.get("termId") ?? "",
    notifyAudience: formData.get("notifyAudience") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  if (parsed.data.endAt < parsed.data.startAt) return { status: "error", message: "End date/time must be after the start." };

  try {
    await createCalendarEvent(user.schoolId, user.id, {
      title: parsed.data.title,
      description: parsed.data.description || null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      classArmId: parsed.data.classArmId || null,
      termId: parsed.data.termId || null,
      notifyAudience: parsed.data.notifyAudience || null,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this event." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "calendar.event_created", resourceType: "CalendarEvent" });
  revalidatePath("/dashboard/administration/calendar");
  return { status: "success" };
}

export async function updateEventAction(_prev: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const user = await requirePermission(PERMISSIONS.CALENDAR_MANAGE);
  const id = String(formData.get("eventId") ?? "");
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    classArmId: formData.get("classArmId") ?? "",
    termId: formData.get("termId") ?? "",
    notifyAudience: formData.get("notifyAudience") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  if (parsed.data.endAt < parsed.data.startAt) return { status: "error", message: "End date/time must be after the start." };

  try {
    await updateCalendarEvent(user.schoolId, id, {
      title: parsed.data.title,
      description: parsed.data.description || null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      classArmId: parsed.data.classArmId || null,
      termId: parsed.data.termId || null,
      notifyAudience: parsed.data.notifyAudience || null,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update this event." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "calendar.event_updated", resourceType: "CalendarEvent", resourceId: id });
  revalidatePath("/dashboard/administration/calendar");
  revalidatePath("/dashboard/administration/calendar/archive");
  return { status: "success" };
}

export async function deleteEventAction(id: string) {
  const user = await requirePermission(PERMISSIONS.CALENDAR_MANAGE);
  await deleteCalendarEvent(user.schoolId, id);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "calendar.event_deleted", resourceType: "CalendarEvent", resourceId: id });
  revalidatePath("/dashboard/administration/calendar");
  revalidatePath("/dashboard/administration/calendar/archive");
}
