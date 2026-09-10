import { prisma } from "@/lib/db";
import type { ChargeType } from "@/generated/prisma/enums";
import { recordAuditLog } from "@/lib/security/audit";
import { recomputeReservationTotals } from "./reservations";

export interface AddChargeInput {
  reservationId: string;
  type: ChargeType;
  description?: string;
  amount: number;
}

export async function addCharge(hotelId: string, actorId: string | null, input: AddChargeInput) {
  if (input.amount <= 0) throw new Error("Charge amount must be greater than zero");

  const reservation = await prisma.reservation.findFirst({ where: { id: input.reservationId, hotelId } });
  if (!reservation) throw new Error("Reservation not found");
  if (!["CONFIRMED", "CHECKED_IN"].includes(reservation.status)) {
    throw new Error("Charges can only be added to a confirmed or checked-in stay");
  }

  const charge = await prisma.$transaction(async (tx) => {
    const created = await tx.additionalCharge.create({
      data: { hotelId, reservationId: input.reservationId, guestId: reservation.guestId, type: input.type, description: input.description, amount: input.amount, recordedById: actorId },
    });
    await recomputeReservationTotals(tx, input.reservationId);
    return created;
  });

  await recordAuditLog({ hotelId, actorId, action: "charge.added", resourceType: "AdditionalCharge", resourceId: charge.id, newValue: { type: input.type, amount: input.amount } });
  return charge;
}

export async function removeCharge(hotelId: string, actorId: string, chargeId: string) {
  const charge = await prisma.additionalCharge.findFirst({ where: { id: chargeId, hotelId } });
  if (!charge) throw new Error("Charge not found");

  await prisma.$transaction(async (tx) => {
    await tx.additionalCharge.delete({ where: { id: chargeId } });
    await recomputeReservationTotals(tx, charge.reservationId);
  });

  await recordAuditLog({ hotelId, actorId, action: "charge.removed", resourceType: "AdditionalCharge", resourceId: chargeId });
}
