import { prisma } from "@/lib/db";
import type { HousekeepingTaskStatus, HousekeepingTaskType } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { setRoomStatus } from "./rooms";

export interface CreateHousekeepingTaskInput {
  roomId: string;
  taskType: HousekeepingTaskType;
  assignedToId?: string;
  notes?: string;
}

export async function listHousekeepingTasks(hotelId: string, filters?: { status?: HousekeepingTaskStatus; assignedToId?: string }) {
  return prisma.housekeepingTask.findMany({
    where: { hotelId, ...(filters?.status ? { status: filters.status } : {}), ...(filters?.assignedToId ? { assignedToId: filters.assignedToId } : {}) },
    include: { room: { include: { roomType: true } }, assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function createHousekeepingTask(hotelId: string, actorId: string | null, input: CreateHousekeepingTaskInput) {
  const room = await prisma.room.findFirst({ where: { id: input.roomId, hotelId } });
  if (!room) throw new Error("Room not found");

  const task = await prisma.housekeepingTask.create({
    data: { hotelId, roomId: input.roomId, taskType: input.taskType, assignedToId: input.assignedToId, notes: input.notes, status: "PENDING" },
  });
  await recordAuditLog({ hotelId, actorId, action: "housekeeping.task_created", resourceType: "HousekeepingTask", resourceId: task.id, newValue: { roomId: input.roomId, taskType: input.taskType } });
  return task;
}

export async function assignHousekeepingTask(hotelId: string, actorId: string, taskId: string, assignedToId: string) {
  const task = await prisma.housekeepingTask.findFirst({ where: { id: taskId, hotelId } });
  if (!task) throw new Error("Task not found");
  const updated = await prisma.housekeepingTask.update({ where: { id: taskId }, data: { assignedToId } });
  await recordAuditLog({ hotelId, actorId, action: "housekeeping.task_assigned", resourceType: "HousekeepingTask", resourceId: taskId, newValue: { assignedToId } });
  return updated;
}

/** Dirty -> Cleaning; the housekeeper has started work on the room. */
export async function startHousekeepingTask(hotelId: string, actorId: string, taskId: string) {
  const task = await prisma.housekeepingTask.findFirst({ where: { id: taskId, hotelId } });
  if (!task) throw new Error("Task not found");
  if (task.status !== "PENDING") throw new Error("Task has already been started");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.housekeepingTask.update({ where: { id: taskId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    await setRoomStatus(hotelId, task.roomId, "CLEANING", actorId, "Housekeeping started", { tx, force: true });
    return result;
  });
  await recordAuditLog({ hotelId, actorId, action: "housekeeping.task_started", resourceType: "HousekeepingTask", resourceId: taskId });
  return updated;
}

/** Cleaning -> Inspected; cleaning is done and the room awaits a manager's sign-off. */
export async function completeHousekeepingTask(hotelId: string, actorId: string, taskId: string, notes?: string) {
  const task = await prisma.housekeepingTask.findFirst({ where: { id: taskId, hotelId } });
  if (!task) throw new Error("Task not found");
  if (task.status !== "IN_PROGRESS") throw new Error("Task must be in progress to complete");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.housekeepingTask.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date(), notes: notes ?? task.notes } });
    await setRoomStatus(hotelId, task.roomId, "INSPECTED", actorId, "Cleaning completed, awaiting inspection", { tx, force: true });
    return result;
  });
  await recordAuditLog({ hotelId, actorId, action: "housekeeping.task_completed", resourceType: "HousekeepingTask", resourceId: taskId });
  return updated;
}

/** Manager inspection: Inspected -> Available (pass) or Dirty + task reopened (fail). */
export async function inspectHousekeepingTask(hotelId: string, actorId: string, taskId: string, passed: boolean, notes?: string) {
  const task = await prisma.housekeepingTask.findFirst({ where: { id: taskId, hotelId } });
  if (!task) throw new Error("Task not found");
  if (task.status !== "COMPLETED") throw new Error("Task must be completed before inspection");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.housekeepingTask.update({
      where: { id: taskId },
      data: passed
        ? { status: "INSPECTED", inspectedAt: new Date(), inspectedById: actorId, notes: notes ?? task.notes }
        : { status: "PENDING", startedAt: null, completedAt: null, notes: notes ?? task.notes },
    });
    await setRoomStatus(hotelId, task.roomId, passed ? "AVAILABLE" : "DIRTY", actorId, passed ? "Passed inspection" : "Failed inspection, needs re-clean", { tx, force: true });
    return result;
  });
  await recordAuditLog({ hotelId, actorId, action: passed ? "housekeeping.inspection_passed" : "housekeeping.inspection_failed", resourceType: "HousekeepingTask", resourceId: taskId });
  return updated;
}
