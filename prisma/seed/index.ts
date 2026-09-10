import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS, HOTEL_ROLE_KEYS } from "../../src/lib/auth/permissions";
import { createHotelWithOwner } from "../../src/lib/services/hotels";
import { createRoomType } from "../../src/lib/services/room-types";
import { createRoom } from "../../src/lib/services/rooms";
import { createGuest } from "../../src/lib/services/guests";
import { createReservation } from "../../src/lib/services/reservations";
import { checkInReservation, checkOutReservation } from "../../src/lib/services/front-desk";
import { recordPayment } from "../../src/lib/services/payments";
import { addCharge } from "../../src/lib/services/additional-charges";
import { createExpense } from "../../src/lib/services/expenses";
import { createHousekeepingTask } from "../../src/lib/services/housekeeping";
import { createMaintenanceRequest } from "../../src/lib/services/maintenance";
import type { RoleKey, StaffDepartment } from "../../src/generated/prisma/enums";

const prisma = new PrismaClient();
const PASSWORD = "Passw0rd!";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function seedPermissions() {
  const permissionRecords = await Promise.all(
    PERMISSION_CATALOG.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: { description: p.description, category: p.category },
        create: { key: p.key, description: p.description, category: p.category },
      })
    )
  );
  const permissionByKey = new Map(permissionRecords.map((p) => [p.key, p]));

  for (const role of HOTEL_ROLE_KEYS) {
    for (const key of ROLE_DEFAULT_PERMISSIONS[role]) {
      const permission = permissionByKey.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleKey_permissionId: { roleKey: role, permissionId: permission.id } },
        update: {},
        create: { roleKey: role, permissionId: permission.id },
      });
    }
  }
  console.log(`Seeded ${permissionRecords.length} permissions across ${HOTEL_ROLE_KEYS.length} roles.`);
}

async function seedSuperAdmin() {
  const email = "admin@stayos.example";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({ data: { name: "Platform Super Admin", email, passwordHash, isSuperAdmin: true, status: "ACTIVE" } });
}

async function addStaffMember(hotelId: string, name: string, email: string, role: RoleKey, department: StaffDepartment) {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = existing ?? (await prisma.user.create({ data: { name, email, passwordHash, status: "ACTIVE", primaryHotelId: hotelId } }));

  const existingMembership = await prisma.hotelMember.findUnique({ where: { hotelId_userId: { hotelId, userId: user.id } } });
  if (existingMembership) return { user, membership: existingMembership };

  const membership = await prisma.hotelMember.create({ data: { hotelId, userId: user.id, role, department, employmentStatus: "ACTIVE" } });
  return { user, membership };
}

interface HotelSeedSpec {
  hotelName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  hotelEmail: string;
  currency: string;
  timezone: string;
  numberOfRooms: number;
  description: string;
  ownerName: string;
  ownerEmail: string;
  slugPrefix: string;
}

async function seedHotel(spec: HotelSeedSpec) {
  let hotel;
  const existingOwner = await prisma.user.findUnique({ where: { email: spec.ownerEmail } });
  if (existingOwner?.primaryHotelId) {
    hotel = await prisma.hotel.findUnique({ where: { id: existingOwner.primaryHotelId } });
  }

  if (!hotel) {
    const result = await createHotelWithOwner({
      hotelName: spec.hotelName,
      address: spec.address,
      city: spec.city,
      state: spec.state,
      country: spec.country,
      phone: spec.phone,
      hotelEmail: spec.hotelEmail,
      currency: spec.currency,
      timezone: spec.timezone,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      numberOfRooms: spec.numberOfRooms,
      description: spec.description,
      ownerName: spec.ownerName,
      ownerEmail: spec.ownerEmail,
      ownerPassword: PASSWORD,
    });
    hotel = result.hotel;
    await prisma.hotel.update({ where: { id: hotel.id }, data: { status: "ACTIVE" } });
  }
  if (!hotel) throw new Error(`Failed to seed hotel ${spec.hotelName}`);

  const manager = await addStaffMember(hotel.id, "Morgan Reyes", `manager@${spec.slugPrefix}.example`, "HOTEL_MANAGER", "MANAGEMENT");
  const receptionist = await addStaffMember(hotel.id, "Ada Bello", `reception@${spec.slugPrefix}.example`, "RECEPTIONIST", "RECEPTION");
  const accountant = await addStaffMember(hotel.id, "Femi Okoro", `accounts@${spec.slugPrefix}.example`, "ACCOUNTANT", "FINANCE");
  const housekeeper = await addStaffMember(hotel.id, "Grace Mensah", `housekeeping@${spec.slugPrefix}.example`, "HOUSEKEEPING", "HOUSEKEEPING");
  const maintenance = await addStaffMember(hotel.id, "Samuel Osei", `maintenance@${spec.slugPrefix}.example`, "MAINTENANCE", "MAINTENANCE");

  const existingRoomTypes = await prisma.roomType.findMany({ where: { hotelId: hotel.id } });
  let roomTypes = existingRoomTypes;
  if (roomTypes.length === 0) {
    const standard = await createRoomType(hotel.id, receptionist.user.id, {
      name: "Standard Room",
      description: "A comfortable room with all the essentials.",
      maxGuests: 2,
      numBeds: 1,
      bedType: "Queen",
      amenities: ["Wi-Fi", "Air conditioning", "TV", "Work desk"],
      basePrice: spec.currency === "NGN" ? 35000 : spec.currency === "ZAR" ? 1200 : 89,
    });
    const deluxe = await createRoomType(hotel.id, receptionist.user.id, {
      name: "Deluxe Room",
      description: "Extra space with a city or garden view.",
      maxGuests: 3,
      numBeds: 1,
      bedType: "King",
      amenities: ["Wi-Fi", "Air conditioning", "Mini bar", "TV", "Balcony"],
      basePrice: spec.currency === "NGN" ? 55000 : spec.currency === "ZAR" ? 1900 : 139,
    });
    const suite = await createRoomType(hotel.id, receptionist.user.id, {
      name: "Executive Suite",
      description: "A spacious suite with a separate living area.",
      maxGuests: 4,
      numBeds: 2,
      bedType: "King + Sofa Bed",
      amenities: ["Wi-Fi", "Air conditioning", "Mini bar", "TV", "Living area", "Bathtub"],
      basePrice: spec.currency === "NGN" ? 95000 : spec.currency === "ZAR" ? 3200 : 249,
    });
    roomTypes = [standard, deluxe, suite];
  }

  const existingRooms = await prisma.room.findMany({ where: { hotelId: hotel.id } });
  let rooms = existingRooms;
  if (rooms.length === 0) {
    const created = [];
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
        created.push(room);
      }
    }
    rooms = created;
  }

  const guestSeeds = [
    { firstName: "Chinedu", lastName: "Okafor", phone: "+2348012345001", email: `chinedu.okafor+${spec.slugPrefix}@example.com`, nationality: "Nigerian" },
    { firstName: "Amara", lastName: "Nwosu", phone: "+2348012345002", email: `amara.nwosu+${spec.slugPrefix}@example.com`, nationality: "Nigerian" },
    { firstName: "Liam", lastName: "Carter", phone: "+27820001111", email: `liam.carter+${spec.slugPrefix}@example.com`, nationality: "South African" },
    { firstName: "Sofia", lastName: "Mendes", phone: "+27820001112", email: `sofia.mendes+${spec.slugPrefix}@example.com`, nationality: "South African" },
    { firstName: "Noah", lastName: "Williams", phone: "+15550001113", email: `noah.williams+${spec.slugPrefix}@example.com`, nationality: "American" },
    { firstName: "Aisha", lastName: "Bakare", phone: "+2348012345006", email: `aisha.bakare+${spec.slugPrefix}@example.com`, nationality: "Nigerian" },
  ];

  const existingGuests = await prisma.guest.findMany({ where: { hotelId: hotel.id } });
  let guests = existingGuests;
  if (guests.length === 0) {
    const created = [];
    for (const g of guestSeeds) {
      created.push(await createGuest(hotel.id, receptionist.user.id, { ...g, idType: "Passport", idNumber: `P${Math.floor(Math.random() * 90000000 + 10000000)}` }));
    }
    guests = created;
  }

  const existingReservations = await prisma.reservation.count({ where: { hotelId: hotel.id } });
  if (existingReservations === 0 && rooms.length >= 5 && guests.length >= 5) {
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
  }

  // A little operational texture: an expense, a housekeeping task, a maintenance request.
  const existingExpenses = await prisma.expense.count({ where: { hotelId: hotel.id } });
  if (existingExpenses === 0) {
    await createExpense(hotel.id, accountant.user.id, { category: "ELECTRICITY", amount: spec.currency === "NGN" ? 120000 : spec.currency === "ZAR" ? 4500 : 320, date: daysFromNow(-3), description: "Monthly electricity bill", vendor: "City Utilities" });
    await createExpense(hotel.id, accountant.user.id, { category: "SUPPLIES", amount: spec.currency === "NGN" ? 45000 : spec.currency === "ZAR" ? 1500 : 110, date: daysFromNow(-1), description: "Toiletries and linens", vendor: "Hotel Supply Co." });
  }

  if (rooms.length > 5) {
    const existingTasks = await prisma.housekeepingTask.count({ where: { hotelId: hotel.id } });
    if (existingTasks === 0) {
      await createHousekeepingTask(hotel.id, manager.user.id, { roomId: rooms[5].id, taskType: "DEEP_CLEANING", assignedToId: housekeeper.user.id, notes: "Quarterly deep clean." });
    }
    const existingRequests = await prisma.maintenanceRequest.count({ where: { hotelId: hotel.id } });
    if (existingRequests === 0) {
      await createMaintenanceRequest(hotel.id, receptionist.user.id, { roomId: rooms[5].id, issueType: "AIR_CONDITIONING", description: "AC unit making a rattling noise.", priority: "MEDIUM", takeRoomOutOfService: false });
      await assignMaintenanceRequestFirst(hotel.id, maintenance.user.id);
    }
  }

  console.log(`Seeded hotel "${hotel.name}" (${spec.currency}) with owner ${spec.ownerEmail}, manager ${manager.user.email}, receptionist ${receptionist.user.email}.`);
  return hotel;
}

async function assignMaintenanceRequestFirst(hotelId: string, assignedToId: string) {
  const request = await prisma.maintenanceRequest.findFirst({ where: { hotelId }, orderBy: { createdAt: "desc" } });
  if (request) await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { assignedToId, status: "ASSIGNED" } });
}

async function main() {
  await seedPermissions();
  await seedSuperAdmin();

  await seedHotel({
    hotelName: "Sunrise Hotel",
    address: "12 Marina Road",
    city: "Lagos",
    state: "Lagos State",
    country: "Nigeria",
    phone: "+234 800 000 0001",
    hotelEmail: "info@sunrisehotel.example",
    currency: "NGN",
    timezone: "Africa/Lagos",
    numberOfRooms: 10,
    description: "A vibrant boutique hotel in the heart of Lagos.",
    ownerName: "Ngozi Adeyemi",
    ownerEmail: "owner@sunrisehotel.example",
    slugPrefix: "sunrisehotel",
  });

  await seedHotel({
    hotelName: "Ocean View Hotel",
    address: "45 Beachfront Avenue",
    city: "Cape Town",
    state: "Western Cape",
    country: "South Africa",
    phone: "+27 21 000 0002",
    hotelEmail: "info@oceanviewhotel.example",
    currency: "ZAR",
    timezone: "Africa/Johannesburg",
    numberOfRooms: 10,
    description: "A relaxed seaside hotel with panoramic ocean views.",
    ownerName: "Thandiwe Mokoena",
    ownerEmail: "owner@oceanviewhotel.example",
    slugPrefix: "oceanviewhotel",
  });

  await seedHotel({
    hotelName: "Royal Suites",
    address: "800 Fifth Avenue",
    city: "New York",
    state: "NY",
    country: "United States",
    phone: "+1 212 555 0003",
    hotelEmail: "info@royalsuites.example",
    currency: "USD",
    timezone: "America/New_York",
    numberOfRooms: 10,
    description: "A modern business hotel in Midtown Manhattan.",
    ownerName: "James Whitfield",
    ownerEmail: "owner@royalsuites.example",
    slugPrefix: "royalsuites",
  });

  console.log("\nSeed complete. All accounts use the password: " + PASSWORD);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
