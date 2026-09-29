import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";

export interface RoomTypeInput {
  name: string;
  description?: string;
  maxGuests: number;
  numBeds: number;
  bedType?: string;
  amenities: string[];
  basePrice: number;
  images?: string[];
}

export async function listRoomTypes(hotelId: string, includeInactive = false) {
  return prisma.roomType.findMany({
    where: { hotelId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { basePrice: "asc" },
    include: { _count: { select: { rooms: true } } },
  });
}

export async function getRoomType(hotelId: string, id: string) {
  return prisma.roomType.findFirst({ where: { id, hotelId } });
}

export async function createRoomType(hotelId: string, actorId: string, input: RoomTypeInput) {
  const roomType = await prisma.roomType.create({
    data: { hotelId, ...input },
  });
  await recordAuditLog({ hotelId, actorId, action: "room_type.created", resourceType: "RoomType", resourceId: roomType.id, newValue: { name: roomType.name } });
  return roomType;
}

export async function updateRoomType(hotelId: string, actorId: string, id: string, input: RoomTypeInput) {
  const existing = await prisma.roomType.findFirst({ where: { id, hotelId } });
  if (!existing) throw new Error("Room type not found");
  const roomType = await prisma.roomType.update({ where: { id }, data: input });
  await recordAuditLog({ hotelId, actorId, action: "room_type.updated", resourceType: "RoomType", resourceId: id, oldValue: { name: existing.name }, newValue: { name: roomType.name } });
  return roomType;
}

export async function archiveRoomType(hotelId: string, actorId: string, id: string) {
  const existing = await prisma.roomType.findFirst({ where: { id, hotelId }, include: { _count: { select: { rooms: true } } } });
  if (!existing) throw new Error("Room type not found");
  const roomType = await prisma.roomType.update({ where: { id }, data: { isActive: false } });
  await recordAuditLog({ hotelId, actorId, action: "room_type.archived", resourceType: "RoomType", resourceId: id });
  return roomType;
}
