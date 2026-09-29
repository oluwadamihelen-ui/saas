"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "./require";

/**
 * Verifies the caller actually belongs to the requested hotel before handing
 * back the membership details the client will merge into its session via
 * useSession().update(...). This is the server-side check that makes hotel
 * switching safe -- the client can request any hotelId, but only an id the
 * caller has a HotelMember row for is ever returned.
 */
export async function resolveHotelSwitch(hotelId: string) {
  const user = await requireUser();
  if (user.isSuperAdmin) throw new Error("Super Admin accounts do not switch hotels");

  const membership = await prisma.hotelMember.findUnique({
    where: { hotelId_userId: { hotelId, userId: user.id } },
    include: { hotel: true },
  });
  if (!membership || membership.employmentStatus !== "ACTIVE") {
    throw new Error("You do not have access to that hotel");
  }

  return {
    hotelId: membership.hotelId,
    hotelName: membership.hotel.name,
    role: membership.role,
    hotelCurrency: membership.hotel.currency,
  };
}

export async function listMyHotels() {
  const user = await requireUser();
  if (user.isSuperAdmin) return [];
  return prisma.hotelMember.findMany({
    where: { userId: user.id, employmentStatus: "ACTIVE" },
    include: { hotel: true },
    orderBy: { hotel: { name: "asc" } },
  });
}
