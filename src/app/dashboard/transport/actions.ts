"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createVehicle,
  createRoute,
  addRouteStop,
  assignStudentToRoute,
  unassignStudentFromRoute,
} from "@/lib/services/transport";
import { logAudit } from "@/lib/audit";

export interface TransportFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const vehicleSchema = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  plateNumber: z.string().trim().min(1, "Enter a plate number"),
  capacity: z.coerce.number().int().positive("Enter a capacity greater than 0"),
  driverName: z.string().trim().optional().or(z.literal("")),
  driverPhone: z.string().trim().optional().or(z.literal("")),
});

export async function createVehicleAction(_prev: TransportFormState, formData: FormData): Promise<TransportFormState> {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_MANAGE);
  const parsed = vehicleSchema.safeParse({
    name: formData.get("name"),
    plateNumber: formData.get("plateNumber"),
    capacity: formData.get("capacity"),
    driverName: formData.get("driverName") ?? "",
    driverPhone: formData.get("driverPhone") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createVehicle(user.schoolId, {
      name: parsed.data.name,
      plateNumber: parsed.data.plateNumber,
      capacity: parsed.data.capacity,
      driverName: parsed.data.driverName || null,
      driverPhone: parsed.data.driverPhone || null,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this vehicle." };
  }
  revalidatePath("/dashboard/transport");
  return { status: "success" };
}

const routeSchema = z.object({
  name: z.string().trim().min(1, "Enter a route name"),
  vehicleId: z.string().trim().optional().or(z.literal("")),
});

export async function createRouteAction(_prev: TransportFormState, formData: FormData): Promise<TransportFormState> {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_MANAGE);
  const parsed = routeSchema.safeParse({ name: formData.get("name"), vehicleId: formData.get("vehicleId") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await createRoute(user.schoolId, parsed.data.name, parsed.data.vehicleId || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this route." };
  }
  revalidatePath("/dashboard/transport");
  return { status: "success" };
}

const stopSchema = z.object({
  routeId: z.string().trim().min(1),
  name: z.string().trim().min(1, "Enter a stop name"),
  order: z.coerce.number().int().min(0),
  pickupTime: z.string().trim().optional().or(z.literal("")),
  dropoffTime: z.string().trim().optional().or(z.literal("")),
});

export async function addRouteStopAction(_prev: TransportFormState, formData: FormData): Promise<TransportFormState> {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_MANAGE);
  const parsed = stopSchema.safeParse({
    routeId: formData.get("routeId"),
    name: formData.get("name"),
    order: formData.get("order"),
    pickupTime: formData.get("pickupTime") ?? "",
    dropoffTime: formData.get("dropoffTime") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await addRouteStop(user.schoolId, parsed.data.routeId, parsed.data.name, parsed.data.order, parsed.data.pickupTime || null, parsed.data.dropoffTime || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add this stop." };
  }
  revalidatePath(`/dashboard/transport/routes/${parsed.data.routeId}`);
  return { status: "success" };
}

const assignSchema = z.object({
  routeId: z.string().trim().min(1),
  studentId: z.string().trim().min(1, "Choose a student"),
  stopId: z.string().trim().optional().or(z.literal("")),
});

export async function assignStudentToRouteAction(_prev: TransportFormState, formData: FormData): Promise<TransportFormState> {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_MANAGE);
  const parsed = assignSchema.safeParse({
    routeId: formData.get("routeId"),
    studentId: formData.get("studentId"),
    stopId: formData.get("stopId") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await assignStudentToRoute(user.schoolId, parsed.data.studentId, parsed.data.routeId, parsed.data.stopId || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not assign this student." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "transport.student_assigned", resourceType: "StudentTransportAssignment" });
  revalidatePath(`/dashboard/transport/routes/${parsed.data.routeId}`);
  return { status: "success" };
}

export async function unassignStudentFromRouteAction(assignmentId: string, routeId: string) {
  const user = await requirePermission(PERMISSIONS.TRANSPORT_MANAGE);
  await unassignStudentFromRoute(user.schoolId, assignmentId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "transport.student_unassigned", resourceType: "StudentTransportAssignment", resourceId: assignmentId });
  revalidatePath(`/dashboard/transport/routes/${routeId}`);
}
