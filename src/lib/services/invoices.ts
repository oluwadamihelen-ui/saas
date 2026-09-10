import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { recordAuditLog } from "@/lib/security/audit";
import { generateInvoiceNumber } from "@/lib/utils/ids";
import { getGuestFolio } from "./folio";

/**
 * Issues the invoice for a reservation from its current folio. The line
 * items are stored as a point-in-time JSON snapshot (see Invoice model) so
 * a later payment or (pre-checkout) charge never silently rewrites an
 * already-issued invoice; a correction is an explicit re-issue, not a
 * live recompute.
 */
export async function generateInvoice(hotelId: string, reservationId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const existing = await db.invoice.findUnique({ where: { reservationId } });
  if (existing) return existing;

  const folio = await getGuestFolio(hotelId, reservationId);
  if (!folio) throw new Error("Reservation not found");

  const reservation = await db.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });

  const lineItems = [
    { description: folio.roomCharge.description, quantity: folio.roomCharge.quantity, unitPrice: folio.roomCharge.unitPrice, total: folio.roomCharge.total },
    ...folio.additionalCharges.map((c) => ({ description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, total: c.total })),
  ];

  const invoice = await db.invoice.create({
    data: {
      hotelId,
      invoiceNumber: generateInvoiceNumber(hotel.invoicePrefix),
      reservationId,
      guestId: reservation.guestId,
      status: folio.balance <= 0 ? "PAID" : "ISSUED",
      lineItems: lineItems as never,
      subtotal: folio.subtotal,
      discount: folio.discount,
      tax: folio.tax,
      total: folio.total,
      amountPaid: folio.amountPaid,
      balance: folio.balance,
    },
  });

  return invoice;
}

export async function getInvoice(hotelId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, hotelId },
    include: { reservation: { include: { room: true, roomType: true } }, hotel: true },
  });
}

export async function getInvoiceForReservation(hotelId: string, reservationId: string) {
  return prisma.invoice.findFirst({ where: { hotelId, reservationId }, include: { reservation: { include: { room: true } } } });
}

export async function listInvoices(hotelId: string, page = 1, pageSize = 20) {
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { hotelId },
      include: { reservation: { include: { guest: true, room: true } } },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where: { hotelId } }),
  ]);
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Refreshes an invoice's snapshot from the current folio -- an explicit correction, audit-logged. */
export async function reissueInvoice(hotelId: string, actorId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, hotelId } });
  if (!invoice) throw new Error("Invoice not found");

  const folio = await getGuestFolio(hotelId, invoice.reservationId);
  if (!folio) throw new Error("Reservation not found");

  const lineItems = [
    { description: folio.roomCharge.description, quantity: folio.roomCharge.quantity, unitPrice: folio.roomCharge.unitPrice, total: folio.roomCharge.total },
    ...folio.additionalCharges.map((c) => ({ description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, total: c.total })),
  ];

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      lineItems: lineItems as never,
      subtotal: folio.subtotal,
      discount: folio.discount,
      tax: folio.tax,
      total: folio.total,
      amountPaid: folio.amountPaid,
      balance: folio.balance,
      status: folio.balance <= 0 ? "PAID" : "ISSUED",
    },
  });

  await recordAuditLog({ hotelId, actorId, action: "invoice.reissued", resourceType: "Invoice", resourceId: invoiceId });
  return updated;
}
