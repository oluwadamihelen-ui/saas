import { prisma } from "@/lib/db";
import { logger } from "@/lib/security/logger";
import { setRoomStatus } from "./rooms";
import { notifyHotelStaff } from "./notifications";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * The platform's one recurring background job (run daily by the worker
 * process, see scripts/worker.ts): reminds staff of tomorrow's arrivals and
 * departures, flags stale outstanding balances, and auto-flags reservations
 * that were never checked in a full day after their check-in date as
 * NO_SHOW -- freeing the room rather than leaving it "reserved" forever.
 */
export async function runDailyOperationsSweep() {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  const hotels = await prisma.hotel.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] } }, select: { id: true, name: true } });

  let noShowCount = 0;
  let reminderCount = 0;

  for (const hotel of hotels) {
    const [arrivalsTomorrow, departuresTomorrow, staleOutstanding, overdueReservations] = await Promise.all([
      prisma.reservation.count({ where: { hotelId: hotel.id, status: { in: ["PENDING", "CONFIRMED"] }, checkInDate: { gte: tomorrow, lt: dayAfterTomorrow } } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, status: "CHECKED_IN", checkOutDate: { gte: tomorrow, lt: dayAfterTomorrow } } }),
      prisma.reservation.count({ where: { hotelId: hotel.id, balance: { gt: 0 }, status: "CHECKED_OUT", checkedOutAt: { lt: addDays(today, -3) } } }),
      prisma.reservation.findMany({ where: { hotelId: hotel.id, status: { in: ["PENDING", "CONFIRMED"] }, checkInDate: { lt: addDays(today, -1) } } }),
    ]);

    if (arrivalsTomorrow > 0 || departuresTomorrow > 0) {
      await notifyHotelStaff(hotel.id, {
        type: "front_desk.daily_reminder",
        title: "Tomorrow at the front desk",
        message: `${arrivalsTomorrow} arrival${arrivalsTomorrow === 1 ? "" : "s"} and ${departuresTomorrow} departure${departuresTomorrow === 1 ? "" : "s"} expected tomorrow.`,
      });
      reminderCount += 1;
    }

    if (staleOutstanding > 0) {
      await notifyHotelStaff(hotel.id, {
        type: "payments.outstanding_reminder",
        title: "Outstanding balances need follow-up",
        message: `${staleOutstanding} checked-out reservation${staleOutstanding === 1 ? " has" : "s have"} an unpaid balance more than 3 days after checkout.`,
      }, ["HOTEL_OWNER", "HOTEL_MANAGER", "ACCOUNTANT"]);
    }

    for (const reservation of overdueReservations) {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({ where: { id: reservation.id }, data: { status: "NO_SHOW" } });
        const room = await tx.room.findUnique({ where: { id: reservation.roomId } });
        if (room?.status === "RESERVED") {
          await setRoomStatus(hotel.id, reservation.roomId, "AVAILABLE", null, "Auto-flagged as no-show", { tx, force: true });
        }
      });
      noShowCount += 1;
    }
  }

  logger.info("operations_sweep.completed", { hotelsProcessed: hotels.length, reminderCount, noShowCount });
  return { hotelsProcessed: hotels.length, reminderCount, noShowCount };
}
