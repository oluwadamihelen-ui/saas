import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod, PaymentProviderType } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { generatePaymentReference } from "@/lib/utils/ids";
import { recomputeReservationTotals } from "./reservations";
import { getActiveProviderKeys, getProviderKeys } from "@/lib/payments/registry";
import { notifyHotelStaff } from "./notifications";

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
  await notifyHotelStaff(hotelId, {
    type: "payment.recorded",
    title: "Payment recorded",
    message: `${guest.firstName} ${guest.lastName} paid ${input.amount} (${input.method.replaceAll("_", " ").toLowerCase()}).`,
  });
  return payment;
}

export interface InitiateOnlinePaymentInput {
  guestId: string;
  reservationId?: string;
  amount: number;
  currency: string;
  redirectUrl: string;
}

/** Starts a hosted checkout with the hotel's active gateway and records a PENDING Payment for the webhook to complete later. */
export async function initiateOnlinePayment(hotelId: string, actorId: string, input: InitiateOnlinePaymentInput) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero");

  const guest = await prisma.guest.findFirst({ where: { id: input.guestId, hotelId } });
  if (!guest) throw new Error("Guest not found");
  if (!guest.email) throw new Error("This guest has no email on file -- add one before sending an online payment link.");

  const resolved = await getActiveProviderKeys(hotelId);
  if (!resolved) throw new Error("This hotel has no active online payment provider configured. Set one up under Settings first.");

  const reference = generatePaymentReference();
  const { checkoutUrl } = await resolved.adapter.initializeCharge(resolved.keys, {
    amount: input.amount,
    currency: input.currency,
    email: guest.email,
    reference,
    redirectUrl: input.redirectUrl,
    customerName: `${guest.firstName} ${guest.lastName}`.trim(),
  });

  const payment = await prisma.payment.create({
    data: {
      hotelId,
      reference,
      guestId: input.guestId,
      reservationId: input.reservationId,
      amount: input.amount,
      method: "PAYMENT_LINK",
      status: "PENDING",
      provider: resolved.provider,
      receivedById: actorId,
    },
  });

  await recordAuditLog({ hotelId, actorId, action: "payment.online_link_created", resourceType: "Payment", resourceId: payment.id, newValue: { amount: input.amount, provider: resolved.provider } });
  return { payment, checkoutUrl };
}

/**
 * Called from a webhook route after independently re-verifying the charge
 * with the provider's own verify endpoint (never trust the webhook body's
 * amount/status alone -- it's attacker-reachable). Idempotent: a Payment
 * already COMPLETED is left untouched rather than double-applied.
 */
export async function confirmOnlinePayment(hotelId: string, reference: string, verifiedAmount: number) {
  const payment = await prisma.payment.findFirst({ where: { hotelId, reference } });
  if (!payment) return null;
  if (payment.status === "COMPLETED") return payment;
  if (payment.status !== "PENDING") return payment;

  if (Math.abs(Number(payment.amount) - verifiedAmount) > 0.01) {
    await recordAuditLog({ hotelId, actorId: null, action: "payment.online_amount_mismatch", resourceType: "Payment", resourceId: payment.id, newValue: { expected: Number(payment.amount), verified: verifiedAmount } });
    throw new Error(`Verified amount (${verifiedAmount}) does not match the expected amount (${payment.amount}) for payment ${reference}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({ where: { id: payment.id }, data: { status: "COMPLETED" } });
    if (payment.reservationId) await recomputeReservationTotals(tx, payment.reservationId);
    return result;
  });

  await recordAuditLog({ hotelId, actorId: null, action: "payment.online_completed", resourceType: "Payment", resourceId: payment.id, newValue: { amount: verifiedAmount, provider: payment.provider } });

  const guest = await prisma.guest.findUnique({ where: { id: payment.guestId } });
  await notifyHotelStaff(hotelId, {
    type: "payment.online_completed",
    title: "Online payment received",
    message: `${guest ? `${guest.firstName} ${guest.lastName}` : "A guest"} completed an online payment of ${verifiedAmount} (${payment.reference}).`,
  });

  return updated;
}

/** Re-verifies a PENDING payment against its provider directly -- used by the webhook route's signature-verified path. */
export async function verifyOnlinePaymentWithProvider(hotelId: string, provider: PaymentProviderType, reference: string) {
  const resolved = await getProviderKeys(hotelId, provider);
  if (!resolved) throw new Error(`No ${provider} credentials on file for this hotel.`);
  return resolved.adapter.verifyCharge(resolved.keys, reference);
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
