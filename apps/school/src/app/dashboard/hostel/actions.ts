"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createHostel, addHostelRoom, assignStudentToRoom, unassignStudentFromRoom } from "@/lib/services/hostel";
import { logAudit } from "@/lib/audit";

export interface HostelFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const hostelSchema = z.object({
  name: z.string().trim().min(1, "Enter a hostel name"),
  type: z.enum(["MALE", "FEMALE", "MIXED"]),
  wardenName: z.string().trim().optional().or(z.literal("")),
  wardenPhone: z.string().trim().optional().or(z.literal("")),
});

export async function createHostelAction(_prev: HostelFormState, formData: FormData): Promise<HostelFormState> {
  const user = await requirePermission(PERMISSIONS.HOSTEL_MANAGE);
  const parsed = hostelSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    wardenName: formData.get("wardenName") ?? "",
    wardenPhone: formData.get("wardenPhone") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  await createHostel(user.schoolId, {
    name: parsed.data.name,
    type: parsed.data.type,
    wardenName: parsed.data.wardenName || null,
    wardenPhone: parsed.data.wardenPhone || null,
  });
  revalidatePath("/dashboard/hostel");
  return { status: "success" };
}

const roomSchema = z.object({
  hostelId: z.string().trim().min(1),
  roomNumber: z.string().trim().min(1, "Enter a room number"),
  capacity: z.coerce.number().int().positive("Enter a capacity greater than 0"),
});

export async function addHostelRoomAction(_prev: HostelFormState, formData: FormData): Promise<HostelFormState> {
  const user = await requirePermission(PERMISSIONS.HOSTEL_MANAGE);
  const parsed = roomSchema.safeParse({
    hostelId: formData.get("hostelId"),
    roomNumber: formData.get("roomNumber"),
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await addHostelRoom(user.schoolId, parsed.data.hostelId, parsed.data.roomNumber, parsed.data.capacity);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this room." };
  }
  revalidatePath(`/dashboard/hostel/${parsed.data.hostelId}`);
  return { status: "success" };
}

const assignSchema = z.object({
  hostelId: z.string().trim().min(1),
  roomId: z.string().trim().min(1, "Choose a room"),
  studentId: z.string().trim().min(1, "Choose a student"),
});

export async function assignStudentToRoomAction(_prev: HostelFormState, formData: FormData): Promise<HostelFormState> {
  const user = await requirePermission(PERMISSIONS.HOSTEL_MANAGE);
  const parsed = assignSchema.safeParse({
    hostelId: formData.get("hostelId"),
    roomId: formData.get("roomId"),
    studentId: formData.get("studentId"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await assignStudentToRoom(user.schoolId, parsed.data.studentId, parsed.data.roomId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not assign this student." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "hostel.student_assigned", resourceType: "HostelBedAssignment" });
  revalidatePath(`/dashboard/hostel/${parsed.data.hostelId}`);
  return { status: "success" };
}

export async function unassignStudentFromRoomAction(assignmentId: string, hostelId: string) {
  const user = await requirePermission(PERMISSIONS.HOSTEL_MANAGE);
  await unassignStudentFromRoom(user.schoolId, assignmentId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "hostel.student_unassigned", resourceType: "HostelBedAssignment", resourceId: assignmentId });
  revalidatePath(`/dashboard/hostel/${hostelId}`);
}
