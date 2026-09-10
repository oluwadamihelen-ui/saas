import { prisma } from "@/lib/db";
import type { MaintenanceIssueType, MaintenancePriority, MaintenanceStatus } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { setRoomStatus } from "./rooms";

export interface CreateMaintenanceRequestInput {
  roomId?: string;
  issueType: MaintenanceIssueType;
  description: string;
  priority: MaintenancePriority;
  takeRoomOutOfService?: boolean;
}

export async function listMaintenanceRequests(hotelId: string, filters?: { status?: MaintenanceStatus }) {
  return prisma.maintenanceRequest.findMany({
    where: { hotelId, ...(filters?.status ? { status: filters.status } : {}) },
    include: { room: true, reportedBy: { select: { name: true } }, assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function createMaintenanceRequest(hotelId: string, actorId: string | null, input: CreateMaintenanceRequestInput) {
  if (input.roomId) {
    const room = await prisma.room.findFirst({ where: { id: input.roomId, hotelId } });
    if (!room) throw new Error("Room not found");
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.maintenanceRequest.create({
      data: { hotelId, roomId: input.roomId, issueType: input.issueType, description: input.description, priority: input.priority, status: "REPORTED", reportedById: actorId },
    });
    if (input.roomId && input.takeRoomOutOfService) {
      await setRoomStatus(hotelId, input.roomId, "MAINTENANCE", actorId, `Maintenance reported: ${input.issueType}`, { tx, force: true });
    }
    return created;
  });

  await recordAuditLog({ hotelId, actorId, action: "maintenance.reported", resourceType: "MaintenanceRequest", resourceId: request.id, newValue: { issueType: input.issueType, priority: input.priority } });
  return request;
}

export async function assignMaintenanceRequest(hotelId: string, actorId: string, requestId: string, assignedToId: string) {
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, hotelId } });
  if (!request) throw new Error("Request not found");
  const updated = await prisma.maintenanceRequest.update({ where: { id: requestId }, data: { assignedToId, status: request.status === "REPORTED" ? "ASSIGNED" : request.status } });
  await recordAuditLog({ hotelId, actorId, action: "maintenance.assigned", resourceType: "MaintenanceRequest", resourceId: requestId, newValue: { assignedToId } });
  return updated;
}

export async function startMaintenanceRequest(hotelId: string, actorId: string, requestId: string) {
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, hotelId } });
  if (!request) throw new Error("Request not found");
  if (!["REPORTED", "ASSIGNED"].includes(request.status)) throw new Error("Request cannot be started from its current status");
  const updated = await prisma.maintenanceRequest.update({ where: { id: requestId }, data: { status: "IN_PROGRESS" } });
  await recordAuditLog({ hotelId, actorId, action: "maintenance.started", resourceType: "MaintenanceRequest", resourceId: requestId });
  return updated;
}

export async function completeMaintenanceRequest(hotelId: string, actorId: string, requestId: string, notes?: string, releaseRoom = true) {
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, hotelId }, include: { room: true } });
  if (!request) throw new Error("Request not found");
  if (request.status === "COMPLETED" || request.status === "CANCELLED") throw new Error("Request is already closed");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.maintenanceRequest.update({ where: { id: requestId }, data: { status: "COMPLETED", resolvedAt: new Date(), notes } });
    if (request.room && request.room.status === "MAINTENANCE" && releaseRoom) {
      await setRoomStatus(hotelId, request.room.id, "AVAILABLE", actorId, "Maintenance resolved", { tx, force: true });
    }
    return result;
  });

  await recordAuditLog({ hotelId, actorId, action: "maintenance.completed", resourceType: "MaintenanceRequest", resourceId: requestId });
  return updated;
}

export async function cancelMaintenanceRequest(hotelId: string, actorId: string, requestId: string) {
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, hotelId } });
  if (!request) throw new Error("Request not found");
  const updated = await prisma.maintenanceRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  await recordAuditLog({ hotelId, actorId, action: "maintenance.cancelled", resourceType: "MaintenanceRequest", resourceId: requestId });
  return updated;
}
