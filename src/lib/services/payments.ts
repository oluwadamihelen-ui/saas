import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { generatePaymentReference } from "@/lib/utils/ids";
import { recomputeReservationTotals } from "./reservations";

export interface RecordPaymentInput {
  guestId: string;
  reservationId?: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

export async function recordPayment(hotelId: string, actorId: string | null, input: RecordPaymentInput, tx?: Prisma.TransactionClient) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero");

  const db = tx ?? prisma;
  const guest = await db.guest.findFirst({ where: { id: input.guestId, hotelId } });
  if (!guest) throw new Error("Guest not found");

  const run = async (client: Prisma.TransactionClient) => {
    const payment = await client.payment.create({
      data: {
        hotelId,
        reference: generatePaymentReference(),
        guestId: input.guestId,
        reservationId: input.reservationId,
        amount: input.amount,
        method: input.method,
        status: "COMPLETED",
        receivedById: actorId,
        notes: input.notes,
      },
    });
    if (input.reservationId) await recomputeReservationTotals(client, input.reservationId);
    return payment;
  };

  const payment = tx ? await run(tx) : await prisma.$transaction(run);

  await recordAuditLog({ hotelId, actorId, action: "payment.recorded", resourceType: "Payment", resourceId: payment.id, newValue: { amount: input.amount, method: input.method, reservationId: input.reservationId } });
  return payment;
}

export async function refundPayment(hotelId: string, actorId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, hotelId } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "COMPLETED") throw new Error("Only completed payments can be refunded");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
    if (payment.reservationId) await recomputeReservationTotals(tx, payment.reservationId);
    return result;
  });

  await recordAuditLog({ hotelId, actorId, action: "payment.refunded", resourceType: "Payment", resourceId: paymentId, newValue: { amount: payment.amount.toString() } });
  return updated;
}

export async function listPayments(hotelId: string, filters?: { method?: PaymentMethod; from?: Date; to?: Date; search?: string; page?: number; pageSize?: number }) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;

  const where: Prisma.PaymentWhereInput = {
    hotelId,
    ...(filters?.method ? { method: filters.method } : {}),
    ...(filters?.from || filters?.to ? { paymentDate: { gte: filters?.from, lte: filters?.to } } : {}),
    ...(filters?.search
      ? {
          OR: [
            { reference: { contains: filters.search, mode: "insensitive" } },
            { guest: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { guest: { lastName: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total, totalsAgg] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { guest: true, reservation: true, receivedBy: { select: { name: true } } },
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amount: true } }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), totalAmount: Number(totalsAgg._sum.amount ?? 0) };
}

export async function listOutstandingReservations(hotelId: string) {
  return prisma.reservation.findMany({
    where: { hotelId, balance: { gt: 0 }, status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } },
    include: { guest: true, room: true },
    orderBy: { balance: "desc" },
  });
}
