"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createHousekeepingTask, startHousekeepingTask, completeHousekeepingTask, inspectHousekeepingTask, assignHousekeepingTask } from "@/lib/services/housekeeping";
import type { HousekeepingTaskType } from "@/generated/prisma/enums";

const taskSchema = z.object({
  roomId: z.string().min(1, "Select a room"),
  taskType: z.custom<HousekeepingTaskType>((v) => typeof v === "string"),
  assignedToId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export interface TaskFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createHousekeepingTaskAction(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await requirePermission(PERMISSIONS.HOUSEKEEPING_MANAGE);
  const parsed = taskSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await createHousekeepingTask(user.hotelId, user.id, { ...parsed.data, assignedToId: parsed.data.assignedToId || undefined });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to create task." };
  }

  revalidatePath("/app/housekeeping");
  return { status: "success" };
}

export async function startTaskAction(taskId: string) {
  const user = await requirePermission(PERMISSIONS.HOUSEKEEPING_MANAGE);
  await startHousekeepingTask(user.hotelId, user.id, taskId);
  revalidatePath("/app/housekeeping");
}

export async function completeTaskAction(taskId: string) {
  const user = await requirePermission(PERMISSIONS.HOUSEKEEPING_MANAGE);
  await completeHousekeepingTask(user.hotelId, user.id, taskId);
  revalidatePath("/app/housekeeping");
}

export async function inspectTaskAction(taskId: string, passed: boolean) {
  const user = await requirePermission(PERMISSIONS.HOUSEKEEPING_MANAGE);
  await inspectHousekeepingTask(user.hotelId, user.id, taskId, passed);
  revalidatePath("/app/housekeeping");
}

export async function assignTaskAction(taskId: string, assignedToId: string) {
  const user = await requirePermission(PERMISSIONS.HOUSEKEEPING_MANAGE);
  await assignHousekeepingTask(user.hotelId, user.id, taskId, assignedToId);
  revalidatePath("/app/housekeeping");
}
