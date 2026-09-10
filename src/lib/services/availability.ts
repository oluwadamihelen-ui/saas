import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Reservation statuses that hold a room for their date range. Cancelled,
// no-show, and checked-out reservations no longer occupy the room's
// calendar -- mirrors the partial index in the database's exclusion
// constraint (see prisma/migrations/.../migration.sql) exactly, so the
// app-level check and the database-level guarantee never disagree.
const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export interface DateRange {
  checkInDate: Date;
  checkOutDate: Date;
}

export function assertValidDateRange({ checkInDate, checkOutDate }: DateRange) {
  if (!(checkInDate instanceof Date) || Number.isNaN(checkInDate.getTime())) throw new Error("Invalid check-in date");
  if (!(checkOutDate instanceof Date) || Number.isNaN(checkOutDate.getTime())) throw new Error("Invalid check-out date");
  if (checkOutDate <= checkInDate) throw new Error("Check-out date must be after check-in date");
}

export function nightsBetween(checkInDate: Date, checkOutDate: Date): number {
  const ms = checkOutDate.getTime() - checkInDate.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Application-level overlap check -- defense in depth alongside the
 * Postgres EXCLUDE constraint on Reservation (roomId, daterange). The
 * database constraint is what actually prevents a double booking under
 * concurrent requests; this check exists so a conflict is reported as a
 * clean validation error before that constraint would reject the insert,
 * and so search results never even offer an unavailable room.
 */
export async function isRoomAvailable(
  hotelId: string,
  roomId: string,
  range: DateRange,
  opts?: { excludeReservationId?: string; tx?: Prisma.TransactionClient }
): Promise<boolean> {
  const db = opts?.tx ?? prisma;
  const conflict = await db.reservation.findFirst({
    where: {
      hotelId,
      roomId,
      id: opts?.excludeReservationId ? { not: opts.excludeReservationId } : undefined,
      status: { in: [...BLOCKING_STATUSES] },
      checkInDate: { lt: range.checkOutDate },
      checkOutDate: { gt: range.checkInDate },
    },
    select: { id: true },
  });
  return !conflict;
}

export interface AvailabilitySearchInput extends DateRange {
  guests?: number;
  roomTypeId?: string;
}

export async function searchAvailableRooms(hotelId: string, input: AvailabilitySearchInput) {
  assertValidDateRange(input);

  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      isActive: true,
      status: { notIn: ["MAINTENANCE", "OUT_OF_SERVICE"] },
      ...(input.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
      ...(input.guests ? { roomType: { maxGuests: { gte: input.guests } } } : {}),
    },
    include: { roomType: true },
    orderBy: [{ roomType: { basePrice: "asc" } }, { roomNumber: "asc" }],
  });

  if (rooms.length === 0) return [];

  const conflicting = await prisma.reservation.findMany({
    where: {
      hotelId,
      roomId: { in: rooms.map((r) => r.id) },
      status: { in: [...BLOCKING_STATUSES] },
      checkInDate: { lt: input.checkOutDate },
      checkOutDate: { gt: input.checkInDate },
    },
    select: { roomId: true },
  });
  const blockedRoomIds = new Set(conflicting.map((c) => c.roomId));

  return rooms.filter((r) => !blockedRoomIds.has(r.id));
}

export async function checkRoomAvailabilityDetailed(hotelId: string, roomId: string, range: DateRange, excludeReservationId?: string) {
  assertValidDateRange(range);
  const available = await isRoomAvailable(hotelId, roomId, range, { excludeReservationId });
  if (available) return { available: true as const };

  const conflicts = await prisma.reservation.findMany({
    where: {
      hotelId,
      roomId,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      status: { in: [...BLOCKING_STATUSES] },
      checkInDate: { lt: range.checkOutDate },
      checkOutDate: { gt: range.checkInDate },
    },
    include: { guest: { select: { firstName: true, lastName: true } } },
  });
  return { available: false as const, conflicts };
}
