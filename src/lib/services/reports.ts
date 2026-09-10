import { prisma } from "@/lib/db";
import { getOccupancySeries } from "./dashboard-metrics";
import { expensesByCategory } from "./expenses";

export interface DateRange {
  from: Date;
  to: Date;
}

export async function occupancyReport(hotelId: string, range: DateRange) {
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const series = await getOccupancySeries(hotelId, days);
  const inRange = series.filter((s) => s.date >= range.from.toISOString().slice(0, 10) && s.date <= range.to.toISOString().slice(0, 10));
  const avgRate = inRange.length > 0 ? Math.round((inRange.reduce((s, d) => s + d.rate, 0) / inRange.length) * 10) / 10 : 0;
  return { series: inRange, averageOccupancyRate: avgRate };
}

export async function revenueReport(hotelId: string, range: DateRange) {
  const payments = await prisma.payment.findMany({
    where: { hotelId, status: "COMPLETED", paymentDate: { gte: range.from, lte: range.to } },
  });
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));

  const byDay = new Map<string, number>();
  for (const p of payments) {
    const key = p.paymentDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(p.amount));
  }

  return {
    total,
    paymentCount: payments.length,
    byMethod: Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount })),
    byDay: Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount })),
  };
}

export async function reservationsReport(hotelId: string, range: DateRange) {
  const reservations = await prisma.reservation.findMany({
    where: { hotelId, createdAt: { gte: range.from, lte: range.to } },
    select: { status: true, source: true },
  });

  const byStatus = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of reservations) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
  }

  const [checkIns, checkOuts, cancellations, noShows] = await Promise.all([
    prisma.reservation.count({ where: { hotelId, checkedInAt: { gte: range.from, lte: range.to } } }),
    prisma.reservation.count({ where: { hotelId, checkedOutAt: { gte: range.from, lte: range.to } } }),
    prisma.reservation.count({ where: { hotelId, cancelledAt: { gte: range.from, lte: range.to } } }),
    prisma.reservation.count({ where: { hotelId, status: "NO_SHOW", updatedAt: { gte: range.from, lte: range.to } } }),
  ]);

  return {
    total: reservations.length,
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    bySource: Array.from(bySource.entries()).map(([source, count]) => ({ source, count })),
    checkIns,
    checkOuts,
    cancellations,
    noShows,
  };
}

export async function roomPerformanceReport(hotelId: string, range: DateRange) {
  const reservations = await prisma.reservation.findMany({
    where: { hotelId, status: { in: ["CHECKED_IN", "CHECKED_OUT"] }, checkInDate: { lte: range.to }, checkOutDate: { gte: range.from } },
    include: { room: true, roomType: true },
  });

  const byRoom = new Map<string, { roomNumber: string; roomType: string; nightsSold: number; revenue: number; stays: number }>();
  for (const r of reservations) {
    const key = r.roomId;
    const existing = byRoom.get(key) ?? { roomNumber: r.room.roomNumber, roomType: r.roomType.name, nightsSold: 0, revenue: 0, stays: 0 };
    existing.nightsSold += r.nights;
    existing.revenue += Number(r.subtotal);
    existing.stays += 1;
    byRoom.set(key, existing);
  }

  return Array.from(byRoom.values()).sort((a, b) => b.revenue - a.revenue);
}

export async function popularRoomTypesReport(hotelId: string, range: DateRange) {
  const reservations = await prisma.reservation.findMany({
    where: { hotelId, createdAt: { gte: range.from, lte: range.to }, status: { notIn: ["CANCELLED"] } },
    include: { roomType: true },
  });
  const byType = new Map<string, { name: string; bookings: number; revenue: number }>();
  for (const r of reservations) {
    const existing = byType.get(r.roomTypeId) ?? { name: r.roomType.name, bookings: 0, revenue: 0 };
    existing.bookings += 1;
    existing.revenue += Number(r.totalAmount);
    byType.set(r.roomTypeId, existing);
  }
  return Array.from(byType.values()).sort((a, b) => b.bookings - a.bookings);
}

export async function guestStatisticsReport(hotelId: string, range: DateRange) {
  const [newGuests, totalGuests, stayCounts, topGuests] = await Promise.all([
    prisma.guest.count({ where: { hotelId, createdAt: { gte: range.from, lte: range.to } } }),
    prisma.guest.count({ where: { hotelId } }),
    prisma.reservation.groupBy({ by: ["guestId"], where: { hotelId, status: { in: ["CHECKED_OUT", "CHECKED_IN"] } }, _count: true }),
    prisma.payment.groupBy({ by: ["guestId"], where: { hotelId, status: "COMPLETED", paymentDate: { gte: range.from, lte: range.to } }, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take: 10 }),
  ]);
  const repeatGuests = stayCounts.filter((r) => r._count > 1).length;

  const guestIds = topGuests.map((g) => g.guestId);
  const guests = await prisma.guest.findMany({ where: { id: { in: guestIds } } });
  const guestMap = new Map(guests.map((g) => [g.id, g]));

  return {
    newGuests,
    totalGuests,
    repeatGuests,
    topGuests: topGuests.map((g) => ({ guest: guestMap.get(g.guestId), totalSpend: Number(g._sum.amount ?? 0) })).filter((g) => g.guest),
  };
}

export async function expensesReport(hotelId: string, range: DateRange) {
  const [byCategory, totalAgg] = await Promise.all([
    expensesByCategory(hotelId, range.from, range.to),
    prisma.expense.aggregate({ where: { hotelId, date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
  ]);
  return { byCategory, total: Number(totalAgg._sum.amount ?? 0) };
}

/**
 * A directional profit estimate: revenue collected minus recorded expenses
 * in the same window. This is NOT accounting-grade profit (it ignores
 * accruals, taxes owed vs. collected, depreciation, etc.) -- it exists to
 * give an at-a-glance signal, and is labeled as an estimate everywhere it's
 * shown in the UI.
 */
export async function profitEstimate(hotelId: string, range: DateRange) {
  const [revenue, expenses] = await Promise.all([revenueReport(hotelId, range), expensesReport(hotelId, range)]);
  return { revenue: revenue.total, expenses: expenses.total, estimatedProfit: revenue.total - expenses.total };
}
