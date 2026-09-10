import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ReservationSource, ReservationStatus } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { generateReservationReference } from "@/lib/utils/ids";
import { assertValidDateRange, isRoomAvailable, nightsBetween } from "./availability";
import { effectiveRoomRate, setRoomStatus } from "./rooms";
import { notifyHotelStaff } from "./notifications";

const POSTGRES_EXCLUSION_VIOLATION = "23P01";

function isExclusionViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === POSTGRES_EXCLUSION_VIOLATION;
}

export interface CreateReservationInput {
  guestId: string;
  roomId: string;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children?: number;
  discount?: number;
  source: ReservationSource;
  notes?: string;
  confirmImmediately?: boolean;
}

/**
 * Recomputes a reservation's totalAmount/balance from its current
 * subtotal/discount/tax plus the live sum of its AdditionalCharge rows and
 * payments. Called after any operation that can change those inputs
 * (charge added/removed, payment recorded, stay extended, room transferred)
 * so Reservation.totalAmount is never hand-edited out of sync with its folio.
 */
export async function recomputeReservationTotals(tx: Prisma.TransactionClient, reservationId: string) {
  const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  const [chargesAgg, paymentsAgg] = await Promise.all([
    tx.additionalCharge.aggregate({ where: { reservationId }, _sum: { amount: true } }),
    tx.payment.aggregate({ where: { reservationId, status: "COMPLETED" }, _sum: { amount: true } }),
  ]);
  const chargesTotal = Number(chargesAgg._sum.amount ?? 0);
  const amountPaid = Number(paymentsAgg._sum.amount ?? 0);
  const totalAmount = Number(reservation.subtotal) - Number(reservation.discount) + Number(reservation.tax) + chargesTotal;
  const balance = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);

  return tx.reservation.update({
    where: { id: reservationId },
    data: { totalAmount, amountPaid, balance },
  });
}

export async function createReservation(hotelId: string, actorId: string | null, input: CreateReservationInput) {
  assertValidDateRange(input);

  const [room, hotel] = await Promise.all([
    prisma.room.findFirst({ where: { id: input.roomId, hotelId }, include: { roomType: true } }),
    prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } }),
  ]);
  if (!room) throw new Error("Room not found");
  if (room.status === "MAINTENANCE" || room.status === "OUT_OF_SERVICE") {
    throw new Error(`Room ${room.roomNumber} is not bookable (${room.status.replace("_", " ").toLowerCase()})`);
  }

  const guest = await prisma.guest.findFirst({ where: { id: input.guestId, hotelId } });
  if (!guest) throw new Error("Guest not found");

  const available = await isRoomAvailable(hotelId, input.roomId, input);
  if (!available) throw new Error(`Room ${room.roomNumber} is not available for the selected dates`);

  const roomRate = effectiveRoomRate(room);
  const nights = nightsBetween(input.checkInDate, input.checkOutDate);
  const subtotal = Math.round(roomRate * nights * 100) / 100;
  const discount = input.discount ?? 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * (Number(hotel.taxRatePercent) / 100) * 100) / 100;
  const totalAmount = taxable + tax;

  let attempt = 0;
  // Reference collisions are astronomically unlikely (6 random digits per
  // year) but retried rather than left to crash a booking outright.
  while (attempt < 5) {
    attempt += 1;
    const reference = generateReservationReference(hotel.reservationPrefix);
    try {
      const reservation = await prisma.$transaction(async (tx) => {
        const created = await tx.reservation.create({
          data: {
            hotelId,
            reference,
            guestId: input.guestId,
            roomId: input.roomId,
            roomTypeId: room.roomTypeId,
            checkInDate: input.checkInDate,
            checkOutDate: input.checkOutDate,
            adults: input.adults,
            children: input.children ?? 0,
            roomRate,
            nights,
            subtotal,
            discount,
            tax,
            totalAmount,
            amountPaid: 0,
            balance: totalAmount,
            status: input.confirmImmediately ? "CONFIRMED" : "PENDING",
            source: input.source,
            notes: input.notes,
            createdById: actorId,
          },
        });

        if (room.status === "AVAILABLE") {
          await setRoomStatus(hotelId, room.id, "RESERVED", actorId, `Reserved via ${created.reference}`, { tx });
        }

        return created;
      });

      await recordAuditLog({ hotelId, actorId, action: "reservation.created", resourceType: "Reservation", resourceId: reservation.id, newValue: { reference: reservation.reference, roomId: room.id } });
      await notifyHotelStaff(hotelId, { type: "reservation.created", title: "New reservation", message: `${guest.firstName} ${guest.lastName} booked Room ${room.roomNumber} (${reservation.reference}).` });

      return reservation;
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new Error(`Room ${room.roomNumber} was just booked for an overlapping date range. Please choose another room or dates.`);
      }
      if (attempt >= 5) throw error;
    }
  }
  throw new Error("Unable to create reservation");
}

export async function getReservation(hotelId: string, id: string) {
  return prisma.reservation.findFirst({
    where: { id, hotelId },
    include: {
      guest: true,
      room: true,
      roomType: true,
      payments: { orderBy: { paymentDate: "desc" } },
      additionalCharges: { orderBy: { date: "desc" }, include: { recordedBy: { select: { name: true } } } },
      roomTransfers: { orderBy: { transferredAt: "desc" }, include: { fromRoom: true, toRoom: true } },
      invoice: true,
      createdBy: { select: { name: true } },
      checkedInBy: { select: { name: true } },
      checkedOutBy: { select: { name: true } },
    },
  });
}

export interface ListReservationsFilters {
  status?: ReservationStatus;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function listReservations(hotelId: string, filters: ListReservationsFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const where: Prisma.ReservationWhereInput = {
    hotelId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { checkOutDate: { gt: filters.from } } : {}),
    ...(filters.to ? { checkInDate: { lt: filters.to } } : {}),
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search, mode: "insensitive" } },
            { guest: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { guest: { lastName: { contains: filters.search, mode: "insensitive" } } },
            { guest: { phone: { contains: filters.search, mode: "insensitive" } } },
            { room: { roomNumber: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: { guest: true, room: true, roomType: true },
      orderBy: { checkInDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function confirmReservation(hotelId: string, actorId: string, id: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "PENDING") throw new Error("Only pending reservations can be confirmed");
  const updated = await prisma.reservation.update({ where: { id }, data: { status: "CONFIRMED" } });
  await recordAuditLog({ hotelId, actorId, action: "reservation.confirmed", resourceType: "Reservation", resourceId: id });
  return updated;
}

export async function cancelReservation(hotelId: string, actorId: string, id: string, reason: string) {
  if (!reason?.trim()) throw new Error("A cancellation reason is required");
  const reservation = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status === "CHECKED_OUT" || reservation.status === "CANCELLED") {
    throw new Error(`Reservation is already ${reservation.status.toLowerCase().replace("_", " ")}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.reservation.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actorId, cancellationReason: reason },
    });

    // Release the room if this was the only thing holding it reserved.
    const room = await tx.room.findUnique({ where: { id: reservation.roomId } });
    if (room?.status === "RESERVED") {
      const stillBooked = await tx.reservation.findFirst({
        where: { hotelId, roomId: reservation.roomId, status: { in: ["PENDING", "CONFIRMED"] }, id: { not: id } },
      });
      if (!stillBooked) await setRoomStatus(hotelId, reservation.roomId, "AVAILABLE", actorId, "Reservation cancelled", { tx, force: true });
    }
    return result;
  });

  await recordAuditLog({ hotelId, actorId, action: "reservation.cancelled", resourceType: "Reservation", resourceId: id, newValue: { reason } });
  return updated;
}

export async function markNoShow(hotelId: string, actorId: string, id: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (!["PENDING", "CONFIRMED"].includes(reservation.status)) throw new Error("Only pending or confirmed reservations can be marked as no-show");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.reservation.update({ where: { id }, data: { status: "NO_SHOW" } });
    const room = await tx.room.findUnique({ where: { id: reservation.roomId } });
    if (room?.status === "RESERVED") {
      await setRoomStatus(hotelId, reservation.roomId, "AVAILABLE", actorId, "Marked as no-show", { tx, force: true });
    }
    return result;
  });

  await recordAuditLog({ hotelId, actorId, action: "reservation.no_show", resourceType: "Reservation", resourceId: id });
  return updated;
}

export async function extendStay(hotelId: string, actorId: string, id: string, newCheckOutDate: Date) {
  const reservation = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (!["CONFIRMED", "CHECKED_IN"].includes(reservation.status)) throw new Error("Only confirmed or checked-in stays can be extended");
  if (newCheckOutDate <= reservation.checkInDate) throw new Error("New check-out date must be after check-in date");
  if (newCheckOutDate <= reservation.checkOutDate) throw new Error("Extension date must be later than the current check-out date");

  const available = await isRoomAvailable(hotelId, reservation.roomId, { checkInDate: reservation.checkOutDate, checkOutDate: newCheckOutDate }, { excludeReservationId: id });
  if (!available) throw new Error("Room is booked by another reservation during the requested extension");

  const nights = nightsBetween(reservation.checkInDate, newCheckOutDate);
  const subtotal = Math.round(Number(reservation.roomRate) * nights * 100) / 100;
  const taxable = Math.max(0, subtotal - Number(reservation.discount));
  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const tax = Math.round(taxable * (Number(hotel.taxRatePercent) / 100) * 100) / 100;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: { checkOutDate: newCheckOutDate, nights, subtotal, tax },
      });
      return recomputeReservationTotals(tx, id);
    });
    await recordAuditLog({ hotelId, actorId, action: "reservation.extended", resourceType: "Reservation", resourceId: id, newValue: { newCheckOutDate } });
    return updated;
  } catch (error) {
    if (isExclusionViolation(error)) throw new Error("Room is booked by another reservation during the requested extension");
    throw error;
  }
}

export async function transferRoom(hotelId: string, actorId: string, id: string, toRoomId: string, reason?: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (!["CONFIRMED", "CHECKED_IN"].includes(reservation.status)) throw new Error("Only confirmed or checked-in stays can be transferred");
  if (toRoomId === reservation.roomId) throw new Error("Choose a different room to transfer to");

  const toRoom = await prisma.room.findFirst({ where: { id: toRoomId, hotelId }, include: { roomType: true } });
  if (!toRoom) throw new Error("Destination room not found");
  if (toRoom.status === "MAINTENANCE" || toRoom.status === "OUT_OF_SERVICE") throw new Error(`Room ${toRoom.roomNumber} is not bookable`);

  const available = await isRoomAvailable(hotelId, toRoomId, reservation, { excludeReservationId: id });
  if (!available) throw new Error(`Room ${toRoom.roomNumber} is not available for these dates`);

  const fromRoomId = reservation.roomId;
  const newRate = effectiveRoomRate(toRoom);
  const subtotal = Math.round(newRate * reservation.nights * 100) / 100;
  const taxable = Math.max(0, subtotal - Number(reservation.discount));
  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const tax = Math.round(taxable * (Number(hotel.taxRatePercent) / 100) * 100) / 100;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: { roomId: toRoomId, roomTypeId: toRoom.roomTypeId, roomRate: newRate, subtotal, tax },
      });
      await recomputeReservationTotals(tx, id);

      await tx.roomTransfer.create({
        data: { hotelId, reservationId: id, fromRoomId, toRoomId, reason, transferredById: actorId },
      });

      if (reservation.status === "CHECKED_IN") {
        await setRoomStatus(hotelId, toRoomId, "OCCUPIED", actorId, `Guest transferred from room`, { tx, force: true });
        await setRoomStatus(hotelId, fromRoomId, "DIRTY", actorId, `Guest transferred out`, { tx, force: true });
      } else {
        await setRoomStatus(hotelId, toRoomId, "RESERVED", actorId, `Reservation transferred in`, { tx, force: true });
        const fromRoom = await tx.room.findUnique({ where: { id: fromRoomId } });
        if (fromRoom?.status === "RESERVED") await setRoomStatus(hotelId, fromRoomId, "AVAILABLE", actorId, "Reservation transferred out", { tx, force: true });
      }

      return tx.reservation.findUniqueOrThrow({ where: { id } });
    });

    await recordAuditLog({ hotelId, actorId, action: "reservation.room_transferred", resourceType: "Reservation", resourceId: id, oldValue: { fromRoomId }, newValue: { toRoomId } });
    return updated;
  } catch (error) {
    if (isExclusionViolation(error)) throw new Error(`Room ${toRoom.roomNumber} is not available for these dates`);
    throw error;
  }
}
