import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";
import type { RoomStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export interface RoomInput {
  roomTypeId: string;
  roomNumber: string;
  floor?: string;
  price?: number | null;
  amenities: string[];
  description?: string;
}

export async function listRooms(hotelId: string, filters?: { status?: RoomStatus; roomTypeId?: string; search?: string }) {
  return prisma.room.findMany({
    where: {
      hotelId,
      isActive: true,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
      ...(filters?.search ? { roomNumber: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    include: { roomType: true },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });
}

export async function getRoom(hotelId: string, id: string) {
  return prisma.room.findFirst({ where: { id, hotelId }, include: { roomType: true } });
}

export async function roomStatusCounts(hotelId: string) {
  const rows = await prisma.room.groupBy({ by: ["status"], where: { hotelId, isActive: true }, _count: true });
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row._count;
  return counts;
}

export async function createRoom(hotelId: string, actorId: string, input: RoomInput) {
  const roomType = await prisma.roomType.findFirst({ where: { id: input.roomTypeId, hotelId } });
  if (!roomType) throw new Error("Room type not found");

  const existing = await prisma.room.findUnique({ where: { hotelId_roomNumber: { hotelId, roomNumber: input.roomNumber } } });
  if (existing) throw new Error(`Room ${input.roomNumber} already exists`);

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.room.create({
      data: {
        hotelId,
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor,
        price: input.price ?? null,
        amenities: input.amenities,
        description: input.description,
        status: "AVAILABLE",
      },
    });
    await tx.roomStatusLog.create({ data: { hotelId, roomId: created.id, toStatus: "AVAILABLE", changedById: actorId, reason: "Room created" } });
    await tx.hotel.update({ where: { id: hotelId }, data: { numberOfRooms: { increment: 1 } } });
    return created;
  });

  await recordAuditLog({ hotelId, actorId, action: "room.created", resourceType: "Room", resourceId: room.id, newValue: { roomNumber: room.roomNumber } });
  return room;
}

export async function updateRoom(hotelId: string, actorId: string, id: string, input: RoomInput) {
  const existing = await prisma.room.findFirst({ where: { id, hotelId } });
  if (!existing) throw new Error("Room not found");

  if (input.roomNumber !== existing.roomNumber) {
    const clash = await prisma.room.findUnique({ where: { hotelId_roomNumber: { hotelId, roomNumber: input.roomNumber } } });
    if (clash) throw new Error(`Room ${input.roomNumber} already exists`);
  }

  const room = await prisma.room.update({
    where: { id },
    data: {
      roomTypeId: input.roomTypeId,
      roomNumber: input.roomNumber,
      floor: input.floor,
      price: input.price ?? null,
      amenities: input.amenities,
      description: input.description,
    },
  });
  await recordAuditLog({ hotelId, actorId, action: "room.updated", resourceType: "Room", resourceId: id, newValue: { roomNumber: room.roomNumber } });
  return room;
}

const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  AVAILABLE: ["RESERVED", "OCCUPIED", "MAINTENANCE", "OUT_OF_SERVICE", "DIRTY"],
  RESERVED: ["OCCUPIED", "AVAILABLE", "MAINTENANCE", "OUT_OF_SERVICE"],
  OCCUPIED: ["DIRTY", "MAINTENANCE"],
  DIRTY: ["CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"],
  CLEANING: ["INSPECTED", "DIRTY", "MAINTENANCE"],
  INSPECTED: ["AVAILABLE", "DIRTY", "MAINTENANCE"],
  MAINTENANCE: ["AVAILABLE", "OUT_OF_SERVICE", "DIRTY"],
  OUT_OF_SERVICE: ["AVAILABLE", "MAINTENANCE"],
};

export function canTransitionRoomStatus(from: RoomStatus, to: RoomStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Central room status transition, used by every workflow that moves a room
 * between states (check-in/out, housekeeping, maintenance, manual override)
 * so every change is validated against the same state machine and logged to
 * RoomStatusLog -- there is no other write path to Room.status.
 */
export async function setRoomStatus(
  hotelId: string,
  roomId: string,
  toStatus: RoomStatus,
  actorId: string | null,
  reason?: string,
  opts?: { force?: boolean; tx?: Prisma.TransactionClient }
) {
  const db = opts?.tx ?? prisma;
  const room = await db.room.findFirst({ where: { id: roomId, hotelId } });
  if (!room) throw new Error("Room not found");

  if (!opts?.force && !canTransitionRoomStatus(room.status, toStatus)) {
    throw new Error(`Cannot move room ${room.roomNumber} from ${room.status} to ${toStatus}`);
  }

  const updated = await db.room.update({ where: { id: roomId }, data: { status: toStatus } });
  await db.roomStatusLog.create({
    data: { hotelId, roomId, fromStatus: room.status, toStatus, changedById: actorId, reason },
  });
  return updated;
}

export async function listRoomStatusHistory(hotelId: string, roomId: string) {
  return prisma.roomStatusLog.findMany({
    where: { hotelId, roomId },
    orderBy: { createdAt: "desc" },
    include: { changedBy: { select: { name: true } } },
    take: 50,
  });
}

export function effectiveRoomRate(room: { price: unknown | null; roomType: { basePrice: unknown } }): number {
  return Number(room.price ?? room.roomType.basePrice);
}
