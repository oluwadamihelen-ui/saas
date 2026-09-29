import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createHotelWithOwner, createHotelBranch, listGroupBranches } from "@/lib/services/hotels";
import { createRoomType } from "@/lib/services/room-types";
import { createRoom } from "@/lib/services/rooms";
import { createGuest } from "@/lib/services/guests";
import { createReservation } from "@/lib/services/reservations";
import { checkInReservation, checkOutReservation } from "@/lib/services/front-desk";
import { recordPayment } from "@/lib/services/payments";
import { addCharge } from "@/lib/services/additional-charges";
import { createExpense } from "@/lib/services/expenses";
import { createHousekeepingTask } from "@/lib/services/housekeeping";
import { createMaintenanceRequest } from "@/lib/services/maintenance";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";
import type { RoleKey, StaffDepartment } from "@/generated/prisma/enums";
import type { Hotel } from "@/generated/prisma/client";

export const DEMO_OWNER_EMAIL = "demo.owner@otelum.io";
export const DEMO_PASSWORD = "OtelumDemo2026!";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function addStaffMember(hotelId: string, name: string, email: string, role: RoleKey, department: StaffDepartment) {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = existing ?? (await prisma.user.create({ data: { name, email, passwordHash, status: "ACTIVE", primaryHotelId: hotelId } }));

  const existingMembership = await prisma.hotelMember.findUnique({ where: { hotelId_userId: { hotelId, userId: user.id } } });
  if (existingMembership) return { user, membership: existingMembership };

  const membership = await prisma.hotelMember.create({ data: { hotelId, userId: user.id, role, department, employmentStatus: "ACTIVE" } });
  return { user, membership };
}

interface BranchOperationalSpec {
  slugPrefix: string;
}

/**
 * Fills an already-created (empty) hotel with staff, inventory, guests,
 * reservations across a spread of statuses, and a little expense/ops
 * texture -- the same shape prospects will see once they start using the
 * product for real. Mirrors prisma/seed/index.ts's seedHotel() tail, kept
 * separate because the seed script isn't part of the app bundle and
 * bootstraps its own PrismaClient with a top-level side effect on import.
 */
async function seedBranchOperationalData(hotel: Hotel, spec: BranchOperationalSpec) {
  const manager = await addStaffMember(hotel.id, "Morgan Reyes", `manager@${spec.slugPrefix}.otelumdemo.example`, "HOTEL_MANAGER", "MANAGEMENT");
  const receptionist = await addStaffMember(hotel.id, "Ada Bello", `reception@${spec.slugPrefix}.otelumdemo.example`, "RECEPTIONIST", "RECEPTION");
  const accountant = await addStaffMember(hotel.id, "Femi Okoro", `accounts@${spec.slugPrefix}.otelumdemo.example`, "ACCOUNTANT", "FINANCE");
  const housekeeper = await addStaffMember(hotel.id, "Grace Mensah", `housekeeping@${spec.slugPrefix}.otelumdemo.example`, "HOUSEKEEPING", "HOUSEKEEPING");
  const maintenance = await addStaffMember(hotel.id, "Samuel Osei", `maintenance@${spec.slugPrefix}.otelumdemo.example`, "MAINTENANCE", "MAINTENANCE");

  const standard = await createRoomType(hotel.id, receptionist.user.id, {
    name: "Standard Room",
    description: "A comfortable room with all the essentials.",
    maxGuests: 2,
    numBeds: 1,
    bedType: "Queen",
    amenities: ["Wi-Fi", "Air conditioning", "TV", "Work desk"],
    basePrice: 35000,
  });
  const deluxe = await createRoomType(hotel.id, receptionist.user.id, {
    name: "Deluxe Room",
    description: "Extra space with a city or garden view.",
    maxGuests: 3,
    numBeds: 1,
    bedType: "King",
    amenities: ["Wi-Fi", "Air conditioning", "Mini bar", "TV", "Balcony"],
    basePrice: 55000,
  });
  const suite = await createRoomType(hotel.id, receptionist.user.id, {
    name: "Executive Suite",
    description: "A spacious suite with a separate living area.",
    maxGuests: 4,
    numBeds: 2,
    bedType: "King + Sofa Bed",
    amenities: ["Wi-Fi", "Air conditioning", "Mini bar", "TV", "Living area", "Bathtub"],
    basePrice: 95000,
  });
  const roomTypes = [standard, deluxe, suite];

  const rooms = [];
  for (const [floorIndex, roomType] of roomTypes.entries()) {
    const floor = String(floorIndex + 1);
    const perType = roomType.name === "Executive Suite" ? 2 : 4;
    for (let i = 1; i <= perType; i++) {
      const roomNumber = `${floor}0${i}`;
      const room = await createRoom(hotel.id, manager.user.id, {
        roomTypeId: roomType.id,
        roomNumber,
        floor,
        amenities: roomType.amenities,
        description: `${roomType.name} on floor ${floor}.`,
      });
      rooms.push(room);
    }
  }

  const guestSeeds = [
    { firstName: "Chinedu", lastName: "Okafor", phone: "+2348012345001", nationality: "Nigerian" },
    { firstName: "Amara", lastName: "Nwosu", phone: "+2348012345002", nationality: "Nigerian" },
    { firstName: "Liam", lastName: "Carter", phone: "+27820001111", nationality: "South African" },
    { firstName: "Sofia", lastName: "Mendes", phone: "+27820001112", nationality: "South African" },
    { firstName: "Noah", lastName: "Williams", phone: "+15550001113", nationality: "American" },
    { firstName: "Aisha", lastName: "Bakare", phone: "+2348012345006", nationality: "Nigerian" },
  ];

  const guests = [];
  for (const g of guestSeeds) {
    guests.push(
      await createGuest(hotel.id, receptionist.user.id, {
        ...g,
        email: `${g.firstName.toLowerCase()}.${g.lastName.toLowerCase()}+${spec.slugPrefix}@otelumdemo.example`,
        idType: "Passport",
        idNumber: `P${Math.floor(Math.random() * 90000000 + 10000000)}`,
      })
    );
  }

  // 1. A completed past stay: booked, checked in, checked out, fully paid, with an extra charge.
  const pastRes = await createReservation(hotel.id, receptionist.user.id, {
    guestId: guests[0].id,
    roomId: rooms[0].id,
    checkInDate: daysFromNow(-5),
    checkOutDate: daysFromNow(-2),
    adults: 1,
    source: "ONLINE",
    confirmImmediately: true,
  });
  await checkInReservation(hotel.id, receptionist.user.id, pastRes.id);
  await addCharge(hotel.id, receptionist.user.id, { reservationId: pastRes.id, type: "ROOM_SERVICE", description: "Breakfast", amount: Math.round(Number(pastRes.roomRate) * 0.08) });
  const pastResTotal = await prisma.reservation.findUniqueOrThrow({ where: { id: pastRes.id } });
  await checkOutReservation(hotel.id, receptionist.user.id, pastRes.id, { payment: { amount: Number(pastResTotal.totalAmount), method: "CARD" } });

  // 2. Currently checked-in guest with a partial payment (outstanding balance).
  const currentRes = await createReservation(hotel.id, receptionist.user.id, {
    guestId: guests[1].id,
    roomId: rooms[1].id,
    checkInDate: daysFromNow(-1),
    checkOutDate: daysFromNow(2),
    adults: 2,
    source: "WALK_IN",
    confirmImmediately: true,
  });
  await checkInReservation(hotel.id, receptionist.user.id, currentRes.id);
  await recordPayment(hotel.id, receptionist.user.id, { guestId: guests[1].id, reservationId: currentRes.id, amount: Math.round(Number(currentRes.totalAmount) * 0.5), method: "CASH" });
  await addCharge(hotel.id, receptionist.user.id, { reservationId: currentRes.id, type: "MINI_BAR", description: "Mini bar snacks", amount: Math.round(Number(currentRes.roomRate) * 0.03) });

  // 3. An upcoming confirmed reservation.
  await createReservation(hotel.id, receptionist.user.id, {
    guestId: guests[2].id,
    roomId: rooms[2].id,
    checkInDate: daysFromNow(5),
    checkOutDate: daysFromNow(8),
    adults: 2,
    children: 1,
    source: "TRAVEL_AGENT",
    confirmImmediately: true,
  });

  // 4. A pending online booking, not yet confirmed.
  await createReservation(hotel.id, receptionist.user.id, {
    guestId: guests[3].id,
    roomId: rooms[3].id,
    checkInDate: daysFromNow(10),
    checkOutDate: daysFromNow(12),
    adults: 1,
    source: "ONLINE",
    confirmImmediately: false,
  });

  // 5. A cancelled reservation (kept for history, room released).
  const cancelRes = await createReservation(hotel.id, receptionist.user.id, {
    guestId: guests[4].id,
    roomId: rooms[4].id,
    checkInDate: daysFromNow(3),
    checkOutDate: daysFromNow(6),
    adults: 1,
    source: "PHONE",
    confirmImmediately: true,
  });
  await prisma.reservation.update({
    where: { id: cancelRes.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: receptionist.user.id, cancellationReason: "Guest changed travel plans." },
  });
  await prisma.room.update({ where: { id: rooms[4].id }, data: { status: "AVAILABLE" } });

  await createExpense(hotel.id, accountant.user.id, { category: "ELECTRICITY", amount: 120000, date: daysFromNow(-3), description: "Monthly electricity bill", vendor: "City Utilities" });
  await createExpense(hotel.id, accountant.user.id, { category: "SUPPLIES", amount: 45000, date: daysFromNow(-1), description: "Toiletries and linens", vendor: "Hotel Supply Co." });

  await createHousekeepingTask(hotel.id, manager.user.id, { roomId: rooms[5].id, taskType: "DEEP_CLEANING", assignedToId: housekeeper.user.id, notes: "Quarterly deep clean." });

  const maintenanceRequest = await createMaintenanceRequest(hotel.id, receptionist.user.id, {
    roomId: rooms[5].id,
    issueType: "AIR_CONDITIONING",
    description: "AC unit making a rattling noise.",
    priority: "MEDIUM",
    takeRoomOutOfService: false,
  });
  await prisma.maintenanceRequest.update({ where: { id: maintenanceRequest.id }, data: { assignedToId: maintenance.user.id, status: "ASSIGNED" } });

  logger.info("demo.branch_seeded", { hotelId: hotel.id, slugPrefix: spec.slugPrefix });
}

export interface DemoAccountResult {
  created: boolean;
  ownerEmail: string;
  password: string;
  branches: Hotel[];
}

/** Reports the existing demo account's branches without creating anything, or null if it doesn't exist yet. */
export async function getDemoAccountStatus(): Promise<DemoAccountResult | null> {
  const existingOwner = await prisma.user.findUnique({ where: { email: DEMO_OWNER_EMAIL } });
  if (!existingOwner?.primaryHotelId) return null;
  const branches = await listGroupBranches(existingOwner.primaryHotelId);
  return { created: false, ownerEmail: DEMO_OWNER_EMAIL, password: DEMO_PASSWORD, branches };
}

/**
 * Creates (or, if already present, simply reports back) a two-branch demo
 * hotel group under one owner login -- meant to be handed to sales
 * prospects so they can explore reservations, front desk, payments,
 * housekeeping and the multi-branch switcher against realistic data
 * without touching anyone's real account. Idempotent: re-running this
 * after the demo account already exists is a safe no-op that just returns
 * the existing credentials, so it's fine to expose as a repeatable button
 * rather than a one-shot script.
 */
export async function seedDemoAccount(actorId: string): Promise<DemoAccountResult> {
  const existing = await getDemoAccountStatus();
  if (existing) return existing;

  const { hotel: hq, user: owner } = await createHotelWithOwner({
    hotelName: "Otelum Demo Hotels — Victoria Island",
    address: "14 Adeola Odeku Street",
    city: "Lagos",
    state: "Lagos State",
    country: "Nigeria",
    phone: "+234 700 000 0100",
    hotelEmail: "frontdesk@vi.otelumdemo.example",
    currency: "NGN",
    timezone: "Africa/Lagos",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    numberOfRooms: 10,
    description: "Flagship property of the Otelum demo group -- explore reservations, front desk, housekeeping, payments and multi-branch switching risk-free.",
    ownerName: "Demo Prospect",
    ownerEmail: DEMO_OWNER_EMAIL,
    ownerPassword: DEMO_PASSWORD,
  });
  await prisma.hotel.update({ where: { id: hq.id }, data: { status: "ACTIVE" } });
  await seedBranchOperationalData(hq, { slugPrefix: "demo-vi" });

  const branch = await createHotelBranch(hq.id, owner.id, {
    hotelName: "Otelum Demo Hotels — Abuja",
    address: "9 Aguiyi Ironsi Street",
    city: "Abuja",
    state: "FCT",
    country: "Nigeria",
    phone: "+234 700 000 0200",
    hotelEmail: "frontdesk@abv.otelumdemo.example",
    currency: "NGN",
    timezone: "Africa/Lagos",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    numberOfRooms: 10,
    description: "Second branch of the Otelum demo group, showing how one login manages more than one property.",
  });
  await prisma.hotel.update({ where: { id: branch.id }, data: { status: "ACTIVE" } });
  await seedBranchOperationalData(branch, { slugPrefix: "demo-abv" });

  await recordAuditLog({
    hotelId: hq.id,
    actorId,
    action: "demo.account_created",
    resourceType: "Hotel",
    resourceId: hq.id,
    newValue: { ownerEmail: DEMO_OWNER_EMAIL, branches: [hq.id, branch.id] },
  });
  logger.info("demo.account_created", { actorId, hqId: hq.id, branchId: branch.id });

  const branches = await listGroupBranches(hq.id);
  return { created: true, ownerEmail: DEMO_OWNER_EMAIL, password: DEMO_PASSWORD, branches };
}
