import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils/ids";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

export interface HotelOnboardingInput {
  hotelName: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  hotelEmail?: string;
  website?: string;
  logoUrl?: string;
  currency: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfRooms: number;
  description?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "hotel";
  let candidate = base;
  let n = 1;
  while (await prisma.hotel.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * Hotel onboarding: creates the Hotel, its first user (HOTEL_OWNER), and the
 * HotelMember row that grants that user access -- all in one transaction, so
 * a partially-created hotel with no owner (or an owner with no hotel) can
 * never exist.
 */
export async function createHotelWithOwner(input: HotelOnboardingInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const slug = await uniqueSlug(input.hotelName);
  const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const hotel = await tx.hotel.create({
      data: {
        name: input.hotelName,
        slug,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        phone: input.phone,
        email: input.hotelEmail,
        website: input.website || null,
        logoUrl: input.logoUrl || null,
        currency: input.currency,
        timezone: input.timezone,
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
        numberOfRooms: input.numberOfRooms,
        description: input.description,
        status: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await tx.user.create({
      data: {
        name: input.ownerName,
        email: input.ownerEmail,
        passwordHash,
        status: "ACTIVE",
        primaryHotelId: hotel.id,
      },
    });

    await tx.hotelMember.create({
      data: {
        hotelId: hotel.id,
        userId: user.id,
        role: "HOTEL_OWNER",
        department: "MANAGEMENT",
        employmentStatus: "ACTIVE",
      },
    });

    return { hotel, user };
  });

  await recordAuditLog({
    hotelId: result.hotel.id,
    actorId: result.user.id,
    action: "hotel.onboarded",
    resourceType: "Hotel",
    resourceId: result.hotel.id,
    newValue: { name: result.hotel.name },
  });

  logger.info("hotel.onboarded", { hotelId: result.hotel.id, ownerId: result.user.id });
  return result;
}

export async function getHotelById(hotelId: string) {
  return prisma.hotel.findUnique({ where: { id: hotelId } });
}

export interface HotelSettingsInput {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  currency: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  taxRatePercent: number;
  invoicePrefix: string;
  reservationPrefix: string;
  description?: string;
}

export async function updateHotelSettings(hotelId: string, actorId: string, input: HotelSettingsInput) {
  const before = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const hotel = await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      phone: input.phone,
      email: input.email,
      website: input.website || null,
      logoUrl: input.logoUrl || null,
      currency: input.currency,
      timezone: input.timezone,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      taxRatePercent: input.taxRatePercent,
      invoicePrefix: input.invoicePrefix,
      reservationPrefix: input.reservationPrefix,
      description: input.description,
    },
  });

  await recordAuditLog({
    hotelId,
    actorId,
    action: "hotel.settings_updated",
    resourceType: "Hotel",
    resourceId: hotelId,
    oldValue: { name: before.name, currency: before.currency, taxRatePercent: before.taxRatePercent.toString() },
    newValue: { name: hotel.name, currency: hotel.currency, taxRatePercent: hotel.taxRatePercent.toString() },
  });

  return hotel;
}

// --- Super Admin -----------------------------------------------------

export async function listHotelsForPlatform() {
  return prisma.hotel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { rooms: true, members: true, reservations: true } },
    },
  });
}

export async function getHotelForPlatform(hotelId: string) {
  return prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { rooms: true, reservations: true, guests: true } },
    },
  });
}

export async function setHotelStatus(hotelId: string, actorId: string, status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED") {
  const hotel = await prisma.hotel.update({ where: { id: hotelId }, data: { status } });
  await recordAuditLog({ hotelId, actorId, action: "hotel.status_changed", resourceType: "Hotel", resourceId: hotelId, newValue: { status } });
  return hotel;
}

export async function setHotelPlan(hotelId: string, actorId: string, subscriptionPlan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE") {
  const hotel = await prisma.hotel.update({ where: { id: hotelId }, data: { subscriptionPlan } });
  await recordAuditLog({ hotelId, actorId, action: "hotel.plan_changed", resourceType: "Hotel", resourceId: hotelId, newValue: { subscriptionPlan } });
  return hotel;
}

export async function getPlatformOverview() {
  const [hotelCount, activeHotels, trialHotels, suspendedHotels, userCount, reservationCount] = await Promise.all([
    prisma.hotel.count(),
    prisma.hotel.count({ where: { status: "ACTIVE" } }),
    prisma.hotel.count({ where: { status: "TRIAL" } }),
    prisma.hotel.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    prisma.reservation.count(),
  ]);

  const byPlan = await prisma.hotel.groupBy({ by: ["subscriptionPlan"], _count: true });

  return { hotelCount, activeHotels, trialHotels, suspendedHotels, userCount, reservationCount, byPlan };
}
