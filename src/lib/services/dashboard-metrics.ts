import { prisma } from "@/lib/db";
import { roomStatusCounts } from "./rooms";

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
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function getDashboardMetrics(hotelId: string) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [
    statusCounts,
    totalActiveRooms,
    arrivalsToday,
    departuresToday,
    currentGuests,
    todaysRevenueAgg,
    outstandingAgg,
    upcomingReservations,
    recentPayments,
    recentCheckIns,
  ] = await Promise.all([
    roomStatusCounts(hotelId),
    prisma.room.count({ where: { hotelId, isActive: true } }),
    prisma.reservation.count({ where: { hotelId, checkInDate: { gte: dayStart, lte: dayEnd }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.reservation.count({ where: { hotelId, checkOutDate: { gte: dayStart, lte: dayEnd }, status: "CHECKED_IN" } }),
    prisma.reservation.count({ where: { hotelId, status: "CHECKED_IN" } }),
    prisma.payment.aggregate({ where: { hotelId, status: "COMPLETED", paymentDate: { gte: dayStart, lte: dayEnd } }, _sum: { amount: true } }),
    prisma.reservation.aggregate({ where: { hotelId, balance: { gt: 0 }, status: { in: ["CHECKED_IN", "CHECKED_OUT", "CONFIRMED"] } }, _sum: { balance: true } }),
    prisma.reservation.findMany({
      where: { hotelId, status: { in: ["PENDING", "CONFIRMED"] }, checkInDate: { gt: dayEnd } },
      include: { guest: true, room: true },
      orderBy: { checkInDate: "asc" },
      take: 6,
    }),
    prisma.payment.findMany({ where: { hotelId, status: "COMPLETED" }, include: { guest: true }, orderBy: { paymentDate: "desc" }, take: 6 }),
    prisma.reservation.findMany({ where: { hotelId, status: "CHECKED_IN" }, include: { guest: true, room: true }, orderBy: { checkedInAt: "desc" }, take: 6 }),
  ]);

  const occupiedRooms = statusCounts.OCCUPIED ?? 0;
  const bookableRooms = totalActiveRooms - (statusCounts.OUT_OF_SERVICE ?? 0);
  const occupancyRate = bookableRooms > 0 ? Math.round((occupiedRooms / bookableRooms) * 1000) / 10 : 0;

  return {
    todaysCheckIns: arrivalsToday,
    todaysCheckOuts: departuresToday,
    currentGuests,
    availableRooms: statusCounts.AVAILABLE ?? 0,
    occupiedRooms,
    reservedRooms: statusCounts.RESERVED ?? 0,
    roomsBeingCleaned: (statusCounts.DIRTY ?? 0) + (statusCounts.CLEANING ?? 0) + (statusCounts.INSPECTED ?? 0),
    totalRooms: totalActiveRooms,
    todaysRevenue: Number(todaysRevenueAgg._sum.amount ?? 0),
    outstandingPayments: Number(outstandingAgg._sum.balance ?? 0),
    occupancyRate,
    upcomingReservations,
    recentPayments,
    recentCheckIns,
    roomStatusCounts: statusCounts,
  };
}

export interface DailyPoint {
  date: string;
  value: number;
}

export async function getOccupancySeries(hotelId: string, days: number) {
  const today = startOfDay(new Date());
  const from = addDays(today, -(days - 1));

  const [totalActiveRooms, reservations] = await Promise.all([
    prisma.room.count({ where: { hotelId, isActive: true, status: { not: "OUT_OF_SERVICE" } } }),
    prisma.reservation.findMany({
      where: { hotelId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, checkInDate: { lt: addDays(today, 1) }, checkOutDate: { gt: from } },
      select: { checkInDate: true, checkOutDate: true },
    }),
  ]);

  const series: { date: string; occupied: number; total: number; rate: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const nextDay = addDays(day, 1);
    const occupied = reservations.filter((r) => r.checkInDate < nextDay && r.checkOutDate > day).length;
    const rate = totalActiveRooms > 0 ? Math.round((occupied / totalActiveRooms) * 1000) / 10 : 0;
    series.push({ date: day.toISOString().slice(0, 10), occupied, total: totalActiveRooms, rate });
  }
  return series;
}

export async function getRevenueSeries(hotelId: string, days: number): Promise<DailyPoint[]> {
  const today = startOfDay(new Date());
  const from = addDays(today, -(days - 1));

  const payments = await prisma.payment.findMany({
    where: { hotelId, status: "COMPLETED", paymentDate: { gte: from, lte: endOfDay(today) } },
    select: { amount: true, paymentDate: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    byDay.set(addDays(from, i).toISOString().slice(0, 10), 0);
  }
  for (const p of payments) {
    const key = p.paymentDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(p.amount));
  }
  return Array.from(byDay.entries()).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
}

export async function getBookingsSeries(hotelId: string, days: number): Promise<DailyPoint[]> {
  const today = startOfDay(new Date());
  const from = addDays(today, -(days - 1));

  const reservations = await prisma.reservation.findMany({
    where: { hotelId, createdAt: { gte: from, lte: endOfDay(today) } },
    select: { createdAt: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) byDay.set(addDays(from, i).toISOString().slice(0, 10), 0);
  for (const r of reservations) {
    const key = r.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return Array.from(byDay.entries()).map(([date, value]) => ({ date, value }));
}
