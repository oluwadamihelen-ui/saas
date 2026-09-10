import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";
import { setRoomStatus } from "./rooms";
import { createReservation, type CreateReservationInput } from "./reservations";
import { recordPayment, type RecordPaymentInput } from "./payments";
import { generateInvoice } from "./invoices";
import { findOrCreateGuestByContact, type GuestInput } from "./guests";
import { notifyHotelStaff } from "./notifications";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function checkInReservation(hotelId: string, actorId: string, reservationId: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, hotelId }, include: { room: true, guest: true } });
  if (!reservation) throw new Error("Reservation not found");
  if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
    throw new Error(`Cannot check in a reservation that is ${reservation.status.toLowerCase().replace("_", " ")}`);
  }
  if (reservation.room.status === "OCCUPIED") throw new Error(`Room ${reservation.room.roomNumber} is currently occupied`);
  if (reservation.room.status === "MAINTENANCE" || reservation.room.status === "OUT_OF_SERVICE") {
    throw new Error(`Room ${reservation.room.roomNumber} is out of service and cannot be checked into`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInById: actorId },
    });
    await setRoomStatus(hotelId, reservation.roomId, "OCCUPIED", actorId, `Checked in (${reservation.reference})`, { tx, force: true });
    return result;
  });

  await recordAuditLog({ hotelId, actorId, action: "reservation.checked_in", resourceType: "Reservation", resourceId: reservationId });
  return updated;
}

export interface CheckOutInput {
  payment?: Omit<RecordPaymentInput, "guestId" | "reservationId">;
  allowOutstandingBalance?: boolean;
}

export async function checkOutReservation(hotelId: string, actorId: string, reservationId: string, input: CheckOutInput = {}) {
  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "CHECKED_IN") throw new Error("Only checked-in stays can be checked out");

  if (input.payment && input.payment.amount > 0) {
    await recordPayment(hotelId, actorId, { guestId: reservation.guestId, reservationId, ...input.payment });
  }

  const fresh = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  if (Number(fresh.balance) > 0.01 && !input.allowOutstandingBalance) {
    throw new Error(`Outstanding balance of ${fresh.balance} must be settled, or explicitly allowed, before checkout`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date(), checkedOutById: actorId },
    });
    await setRoomStatus(hotelId, reservation.roomId, "DIRTY", actorId, `Checked out (${reservation.reference})`, { tx, force: true });
    await tx.housekeepingTask.create({
      data: { hotelId, roomId: reservation.roomId, taskType: "CLEAN_ROOM", status: "PENDING", notes: `Post-checkout cleaning for ${reservation.reference}` },
    });
    const invoice = await generateInvoice(hotelId, reservationId, tx);
    return { reservation: updated, invoice };
  });

  await recordAuditLog({ hotelId, actorId, action: "reservation.checked_out", resourceType: "Reservation", resourceId: reservationId, newValue: { outstandingAllowed: Boolean(input.allowOutstandingBalance) } });
  await notifyHotelStaff(hotelId, { type: "housekeeping.needed", title: "Room needs cleaning", message: `Room is ready for housekeeping after checkout (${reservation.reference}).` }, ["HOTEL_MANAGER", "HOUSEKEEPING"]);

  return result;
}

export interface WalkInInput {
  guest: GuestInput;
  reservation: Omit<CreateReservationInput, "guestId" | "source">;
  payment?: { amount: number; method: RecordPaymentInput["method"]; notes?: string };
  checkInNow: boolean;
}

/**
 * The full walk-in workflow in one call: find-or-create the guest, create
 * the reservation (with the same availability/overlap guarantees as any
 * other booking), optionally take a payment, and optionally check the
 * guest in immediately -- all as one operation so a receptionist doesn't
 * leave a half-completed walk-in behind if step 3 of 4 fails.
 */
export async function createWalkIn(hotelId: string, actorId: string, input: WalkInInput) {
  const guest = await findOrCreateGuestByContact(hotelId, actorId, input.guest);

  const reservation = await createReservation(hotelId, actorId, {
    ...input.reservation,
    guestId: guest.id,
    source: "WALK_IN",
    confirmImmediately: true,
  });

  if (input.payment && input.payment.amount > 0) {
    await recordPayment(hotelId, actorId, { guestId: guest.id, reservationId: reservation.id, amount: input.payment.amount, method: input.payment.method, notes: input.payment.notes });
  }

  if (input.checkInNow) {
    const checkedIn = await checkInReservation(hotelId, actorId, reservation.id);
    return { guest, reservation: checkedIn };
  }

  return { guest, reservation };
}

export async function getFrontDeskBoard(hotelId: string, referenceDate = new Date()) {
  const dayStart = startOfDay(referenceDate);
  const dayEnd = endOfDay(referenceDate);

  const [arrivalsToday, departuresToday, currentGuests, availableRooms, outstanding, noShowCandidates] = await Promise.all([
    prisma.reservation.findMany({
      where: { hotelId, checkInDate: { gte: dayStart, lte: dayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { guest: true, room: true, roomType: true },
      orderBy: { checkInDate: "asc" },
    }),
    prisma.reservation.findMany({
      where: { hotelId, checkOutDate: { gte: dayStart, lte: dayEnd }, status: "CHECKED_IN" },
      include: { guest: true, room: true, roomType: true },
      orderBy: { checkOutDate: "asc" },
    }),
    prisma.reservation.findMany({
      where: { hotelId, status: "CHECKED_IN" },
      include: { guest: true, room: true },
      orderBy: { checkOutDate: "asc" },
    }),
    prisma.room.count({ where: { hotelId, isActive: true, status: "AVAILABLE" } }),
    prisma.reservation.findMany({
      where: { hotelId, balance: { gt: 0 }, status: { in: ["CHECKED_IN", "CHECKED_OUT", "CONFIRMED"] } },
      include: { guest: true, room: true },
      orderBy: { balance: "desc" },
      take: 10,
    }),
    prisma.reservation.findMany({
      where: { hotelId, status: { in: ["PENDING", "CONFIRMED"] }, checkInDate: { lt: dayStart } },
      include: { guest: true, room: true },
      orderBy: { checkInDate: "asc" },
    }),
  ]);

  return { arrivalsToday, departuresToday, currentGuests, availableRoomsCount: availableRooms, outstanding, noShowCandidates };
}
