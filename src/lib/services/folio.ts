import { prisma } from "@/lib/db";

export interface FolioLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  date: Date;
}

export interface GuestFolio {
  reservationId: string;
  reference: string;
  roomCharge: FolioLine;
  additionalCharges: FolioLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: { id: string; reference: string; amount: number; method: string; paymentDate: Date }[];
  amountPaid: number;
  balance: number;
}

/**
 * The guest folio: every room charge, additional charge and payment tied to
 * one reservation, computed live from the database -- never a cached copy,
 * so it always reflects the latest charge or payment.
 */
export async function getGuestFolio(hotelId: string, reservationId: string): Promise<GuestFolio | null> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: {
      room: true,
      additionalCharges: { orderBy: { date: "asc" } },
      payments: { where: { status: "COMPLETED" }, orderBy: { paymentDate: "asc" } },
    },
  });
  if (!reservation) return null;

  const roomCharge: FolioLine = {
    description: `Room ${reservation.room.roomNumber} (${reservation.nights} night${reservation.nights === 1 ? "" : "s"} @ ${Number(reservation.roomRate).toFixed(2)})`,
    quantity: reservation.nights,
    unitPrice: Number(reservation.roomRate),
    total: Number(reservation.subtotal),
    date: reservation.checkInDate,
  };

  const additionalCharges: FolioLine[] = reservation.additionalCharges.map((c) => ({
    description: c.description ? `${c.type.replaceAll("_", " ")} — ${c.description}` : c.type.replaceAll("_", " "),
    quantity: 1,
    unitPrice: Number(c.amount),
    total: Number(c.amount),
    date: c.date,
  }));

  return {
    reservationId: reservation.id,
    reference: reservation.reference,
    roomCharge,
    additionalCharges,
    subtotal: Number(reservation.subtotal),
    discount: Number(reservation.discount),
    tax: Number(reservation.tax),
    total: Number(reservation.totalAmount),
    payments: reservation.payments.map((p) => ({ id: p.id, reference: p.reference, amount: Number(p.amount), method: p.method, paymentDate: p.paymentDate })),
    amountPaid: Number(reservation.amountPaid),
    balance: Number(reservation.balance),
  };
}
