import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";

export interface GuestInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  dateOfBirth?: Date | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  preferences?: string;
  notes?: string;
}

export async function searchGuests(hotelId: string, query?: string, take = 50) {
  return prisma.guest.findMany({
    where: {
      hotelId,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getGuestProfile(hotelId: string, guestId: string) {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, hotelId },
    include: {
      reservations: {
        orderBy: { checkInDate: "desc" },
        include: { room: true, roomType: true, payments: true, additionalCharges: true },
      },
      payments: { orderBy: { paymentDate: "desc" }, take: 20 },
    },
  });
  if (!guest) return null;

  const currentStay = guest.reservations.find((r) => r.status === "CHECKED_IN") ?? null;
  const pastStays = guest.reservations.filter((r) => r.status === "CHECKED_OUT");
  const upcoming = guest.reservations.filter((r) => r.status === "PENDING" || r.status === "CONFIRMED");
  const totalSpend = guest.payments.reduce((sum, p) => (p.status === "COMPLETED" ? sum + Number(p.amount) : sum), 0);

  return { guest, currentStay, pastStays, upcoming, totalSpend };
}

export async function createGuest(hotelId: string, actorId: string | null, input: GuestInput) {
  const guest = await prisma.guest.create({ data: { hotelId, ...input } });
  await recordAuditLog({ hotelId, actorId, action: "guest.created", resourceType: "Guest", resourceId: guest.id, newValue: { name: `${guest.firstName} ${guest.lastName}` } });
  return guest;
}

export async function updateGuest(hotelId: string, actorId: string, guestId: string, input: GuestInput) {
  const existing = await prisma.guest.findFirst({ where: { id: guestId, hotelId } });
  if (!existing) throw new Error("Guest not found");
  const guest = await prisma.guest.update({ where: { id: guestId }, data: input });
  await recordAuditLog({ hotelId, actorId, action: "guest.updated", resourceType: "Guest", resourceId: guestId });
  return guest;
}

export async function findOrCreateGuestByContact(hotelId: string, actorId: string | null, input: GuestInput) {
  if (input.email) {
    const existing = await prisma.guest.findFirst({ where: { hotelId, email: input.email } });
    if (existing) return existing;
  }
  if (input.phone) {
    const existing = await prisma.guest.findFirst({ where: { hotelId, phone: input.phone } });
    if (existing) return existing;
  }
  return createGuest(hotelId, actorId, input);
}
