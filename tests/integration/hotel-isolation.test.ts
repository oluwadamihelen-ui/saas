import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createHotelWithOwner } from "@/lib/services/hotels";
import { createRoomType } from "@/lib/services/room-types";
import { createRoom } from "@/lib/services/rooms";
import { createGuest } from "@/lib/services/guests";
import { createReservation } from "@/lib/services/reservations";
import { getRoom, listRooms } from "@/lib/services/rooms";
import { getGuestProfile, searchGuests } from "@/lib/services/guests";
import { getReservation, listReservations } from "@/lib/services/reservations";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/auth/permissions";

const runId = Math.random().toString(36).slice(2, 8);

describe("multi-hotel data isolation", () => {
  let hotelA: { id: string; ownerId: string; roomId: string; guestId: string; reservationId: string };
  let hotelB: { id: string; ownerId: string; roomId: string; guestId: string; reservationId: string };

  beforeAll(async () => {
    async function buildHotel(label: string) {
      const { hotel, user } = await createHotelWithOwner({
        hotelName: `Isolation Test ${label} ${runId}`,
        currency: "USD",
        timezone: "UTC",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        numberOfRooms: 1,
        ownerName: `Owner ${label}`,
        ownerEmail: `owner-iso-${label.toLowerCase()}-${runId}@example.com`,
        ownerPassword: "Passw0rd!",
      });
      const roomType = await createRoomType(hotel.id, user.id, { name: "Standard", maxGuests: 2, numBeds: 1, amenities: [], basePrice: 100 });
      const room = await createRoom(hotel.id, user.id, { roomTypeId: roomType.id, roomNumber: "101", amenities: [] });
      const guest = await createGuest(hotel.id, user.id, { firstName: label, lastName: "Guest" });
      const reservation = await createReservation(hotel.id, user.id, {
        guestId: guest.id,
        roomId: room.id,
        checkInDate: new Date("2027-06-01T00:00:00Z"),
        checkOutDate: new Date("2027-06-03T00:00:00Z"),
        adults: 1,
        source: "WALK_IN",
        confirmImmediately: true,
      });
      return { id: hotel.id, ownerId: user.id, roomId: room.id, guestId: guest.id, reservationId: reservation.id };
    }

    hotelA = await buildHotel("A");
    hotelB = await buildHotel("B");
  });

  afterAll(async () => {
    for (const h of [hotelA, hotelB]) {
      await prisma.user.updateMany({ where: { primaryHotelId: h.id }, data: { primaryHotelId: null } });
      await prisma.hotel.delete({ where: { id: h.id } });
      await prisma.user.deleteMany({ where: { id: h.ownerId } });
    }
  });

  it("never returns Hotel B's room when queried with Hotel A's id", async () => {
    const room = await getRoom(hotelA.id, hotelB.roomId);
    expect(room).toBeNull();
  });

  it("never returns Hotel B's guest profile when queried with Hotel A's id", async () => {
    const profile = await getGuestProfile(hotelA.id, hotelB.guestId);
    expect(profile).toBeNull();
  });

  it("never returns Hotel B's reservation when queried with Hotel A's id", async () => {
    const reservation = await getReservation(hotelA.id, hotelB.reservationId);
    expect(reservation).toBeNull();
  });

  it("room listings for Hotel A never include Hotel B's rooms", async () => {
    const rooms = await listRooms(hotelA.id);
    expect(rooms.every((r) => r.id !== hotelB.roomId)).toBe(true);
    expect(rooms.some((r) => r.id === hotelA.roomId)).toBe(true);
  });

  it("guest search for Hotel A never includes Hotel B's guests", async () => {
    const guests = await searchGuests(hotelA.id, "Guest");
    expect(guests.every((g) => g.id !== hotelB.guestId)).toBe(true);
  });

  it("reservation listings for Hotel A never include Hotel B's reservations", async () => {
    const { items } = await listReservations(hotelA.id);
    expect(items.every((r) => r.id !== hotelB.reservationId)).toBe(true);
  });

  it("a user with no membership at a hotel resolves to zero permissions there", async () => {
    const perms = await getUserPermissions(hotelA.ownerId, hotelB.id);
    expect(perms.has(PERMISSIONS.RESERVATIONS_MANAGE)).toBe(false);
    expect(perms.size).toBe(0);
  });

  it("the same owner has full permissions at their own hotel", async () => {
    const perms = await getUserPermissions(hotelA.ownerId, hotelA.id);
    expect(perms.has(PERMISSIONS.RESERVATIONS_MANAGE)).toBe(true);
  });
});
