"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createMaintenanceRequest, startMaintenanceRequest, completeMaintenanceRequest, cancelMaintenanceRequest, assignMaintenanceRequest } from "@/lib/services/maintenance";
import type { MaintenanceIssueType, MaintenancePriority } from "@/generated/prisma/enums";

const requestSchema = z.object({
  roomId: z.string().optional(),
  issueType: z.custom<MaintenanceIssueType>((v) => typeof v === "string"),
  description: z.string().trim().min(1, "Describe the issue").max(1000),
  priority: z.custom<MaintenancePriority>((v) => typeof v === "string"),
  takeRoomOutOfService: z.string().optional(),
});

export interface RequestFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createMaintenanceRequestAction(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const parsed = requestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await createMaintenanceRequest(user.hotelId, user.id, {
      roomId: parsed.data.roomId || undefined,
      issueType: parsed.data.issueType,
      description: parsed.data.description,
      priority: parsed.data.priority,
      takeRoomOutOfService: parsed.data.takeRoomOutOfService === "on",
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to report issue." };
  }

  revalidatePath("/app/maintenance");
  return { status: "success" };
}

export async function assignRequestAction(id: string, assignedToId: string) {
  const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  await assignMaintenanceRequest(user.hotelId, user.id, id, assignedToId);
  revalidatePath("/app/maintenance");
}

export async function startRequestAction(id: string) {
  const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  await startMaintenanceRequest(user.hotelId, user.id, id);
  revalidatePath("/app/maintenance");
}

export async function completeRequestAction(id: string) {
  const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  await completeMaintenanceRequest(user.hotelId, user.id, id);
  revalidatePath("/app/maintenance");
}

export async function cancelRequestAction(id: string) {
  const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  await cancelMaintenanceRequest(user.hotelId, user.id, id);
  revalidatePath("/app/maintenance");
}
