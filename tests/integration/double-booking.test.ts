import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createHotelWithOwner } from "@/lib/services/hotels";
import { createRoomType } from "@/lib/services/room-types";
import { createRoom } from "@/lib/services/rooms";
import { createGuest } from "@/lib/services/guests";
import { createReservation, cancelReservation, extendStay, transferRoom } from "@/lib/services/reservations";
import { isRoomAvailable } from "@/lib/services/availability";

const runId = Math.random().toString(36).slice(2, 8);

describe("double booking prevention", () => {
  let hotelId: string;
  let ownerId: string;
  let roomAId: string;
  let roomBId: string;
  let guest1Id: string;
  let guest2Id: string;

  beforeAll(async () => {
    const { hotel, user } = await createHotelWithOwner({
      hotelName: `Test Hotel DB ${runId}`,
      currency: "USD",
      timezone: "UTC",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      numberOfRooms: 2,
      ownerName: "Test Owner",
      ownerEmail: `owner-db-${runId}@example.com`,
      ownerPassword: "Passw0rd!",
    });
    hotelId = hotel.id;
    ownerId = user.id;

    const roomType = await createRoomType(hotelId, ownerId, { name: "Standard", maxGuests: 2, numBeds: 1, amenities: [], basePrice: 100 });
    const roomA = await createRoom(hotelId, ownerId, { roomTypeId: roomType.id, roomNumber: "101", amenities: [] });
    const roomB = await createRoom(hotelId, ownerId, { roomTypeId: roomType.id, roomNumber: "102", amenities: [] });
    roomAId = roomA.id;
    roomBId = roomB.id;

    const guest1 = await createGuest(hotelId, ownerId, { firstName: "Guest", lastName: "One" });
    const guest2 = await createGuest(hotelId, ownerId, { firstName: "Guest", lastName: "Two" });
    guest1Id = guest1.id;
    guest2Id = guest2.id;
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { primaryHotelId: hotelId }, data: { primaryHotelId: null } });
    await prisma.hotel.delete({ where: { id: hotelId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it("prevents a second reservation from overlapping an existing one on the same room", async () => {
    await createReservation(hotelId, ownerId, {
      guestId: guest1Id,
      roomId: roomAId,
      checkInDate: new Date("2027-01-10T00:00:00Z"),
      checkOutDate: new Date("2027-01-15T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });

    await expect(
      createReservation(hotelId, ownerId, {
        guestId: guest2Id,
        roomId: roomAId,
        checkInDate: new Date("2027-01-12T00:00:00Z"),
        checkOutDate: new Date("2027-01-18T00:00:00Z"),
        adults: 1,
        source: "WALK_IN",
        confirmImmediately: true,
      })
    ).rejects.toThrow(/not available/i);
  });

  it("allows a back-to-back reservation starting exactly on the previous checkout date", async () => {
    const reservation = await createReservation(hotelId, ownerId, {
      guestId: guest2Id,
      roomId: roomAId,
      checkInDate: new Date("2027-01-15T00:00:00Z"),
      checkOutDate: new Date("2027-01-18T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });
    expect(reservation.roomId).toBe(roomAId);
  });

  it("allows the same date range on a different room", async () => {
    const available = await isRoomAvailable(hotelId, roomBId, { checkInDate: new Date("2027-01-10T00:00:00Z"), checkOutDate: new Date("2027-01-15T00:00:00Z") });
    expect(available).toBe(true);
  });

  it("frees the room for the same dates once the reservation is cancelled", async () => {
    const reservation = await createReservation(hotelId, ownerId, {
      guestId: guest1Id,
      roomId: roomBId,
      checkInDate: new Date("2027-02-01T00:00:00Z"),
      checkOutDate: new Date("2027-02-05T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });
    await cancelReservation(hotelId, ownerId, reservation.id, "Testing cancellation");

    const available = await isRoomAvailable(hotelId, roomBId, { checkInDate: new Date("2027-02-01T00:00:00Z"), checkOutDate: new Date("2027-02-05T00:00:00Z") });
    expect(available).toBe(true);
  });

  it("rejects extending a stay into dates already booked by another reservation", async () => {
    const stay = await createReservation(hotelId, ownerId, {
      guestId: guest1Id,
      roomId: roomBId,
      checkInDate: new Date("2027-03-01T00:00:00Z"),
      checkOutDate: new Date("2027-03-05T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });
    await createReservation(hotelId, ownerId, {
      guestId: guest2Id,
      roomId: roomBId,
      checkInDate: new Date("2027-03-06T00:00:00Z"),
      checkOutDate: new Date("2027-03-10T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });

    await expect(extendStay(hotelId, ownerId, stay.id, new Date("2027-03-08T00:00:00Z"))).rejects.toThrow();
  });

  it("rejects transferring a guest into a room that is already booked for those dates", async () => {
    const roomType = await createRoomType(hotelId, ownerId, { name: "Deluxe", maxGuests: 2, numBeds: 1, amenities: [], basePrice: 150 });
    const roomC = await createRoom(hotelId, ownerId, { roomTypeId: roomType.id, roomNumber: "201", amenities: [] });
    const roomD = await createRoom(hotelId, ownerId, { roomTypeId: roomType.id, roomNumber: "202", amenities: [] });

    const stay = await createReservation(hotelId, ownerId, {
      guestId: guest1Id,
      roomId: roomC.id,
      checkInDate: new Date("2027-04-01T00:00:00Z"),
      checkOutDate: new Date("2027-04-05T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });
    await createReservation(hotelId, ownerId, {
      guestId: guest2Id,
      roomId: roomD.id,
      checkInDate: new Date("2027-04-01T00:00:00Z"),
      checkOutDate: new Date("2027-04-05T00:00:00Z"),
      adults: 1,
      source: "WALK_IN",
      confirmImmediately: true,
    });

    await expect(transferRoom(hotelId, ownerId, stay.id, roomD.id)).rejects.toThrow();
  });
});
