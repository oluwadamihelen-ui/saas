import "server-only";
import { prisma } from "@/lib/db";

export async function listHostels(schoolId: string) {
  return prisma.hostel.findMany({
    where: { schoolId },
    include: { rooms: { include: { _count: { select: { assignments: { where: { endedAt: null } } } } } } },
    orderBy: { name: "asc" },
  });
}

export interface HostelInput {
  name: string;
  type: "MALE" | "FEMALE" | "MIXED";
  wardenName?: string | null;
  wardenPhone?: string | null;
}

export async function createHostel(schoolId: string, input: HostelInput) {
  return prisma.hostel.create({ data: { schoolId, ...input } });
}

export async function getHostel(schoolId: string, id: string) {
  return prisma.hostel.findFirst({
    where: { schoolId, id },
    include: {
      rooms: {
        include: {
          assignments: { where: { endedAt: null }, include: { student: true } },
        },
        orderBy: { roomNumber: "asc" },
      },
    },
  });
}

export async function addHostelRoom(schoolId: string, hostelId: string, roomNumber: string, capacity: number) {
  const hostel = await prisma.hostel.findFirst({ where: { id: hostelId, schoolId } });
  if (!hostel) throw new Error("Hostel not found.");
  return prisma.hostelRoom.create({ data: { schoolId, hostelId, roomNumber, capacity } });
}

/// Ends any existing active assignment for this student first — one active
/// room assignment per student, enforced here rather than a DB constraint,
/// the same pattern as assignStudentToRoute.
export async function assignStudentToRoom(schoolId: string, studentId: string, roomId: string) {
  const room = await prisma.hostelRoom.findFirst({
    where: { id: roomId, schoolId },
    include: { _count: { select: { assignments: { where: { endedAt: null } } } } },
  });
  if (!room) throw new Error("Room not found.");
  if (room._count.assignments >= room.capacity) throw new Error("This room is already full.");

  await prisma.hostelBedAssignment.updateMany({
    where: { schoolId, studentId, endedAt: null },
    data: { endedAt: new Date() },
  });

  return prisma.hostelBedAssignment.create({ data: { schoolId, studentId, roomId } });
}

export async function unassignStudentFromRoom(schoolId: string, assignmentId: string) {
  const assignment = await prisma.hostelBedAssignment.findFirst({ where: { schoolId, id: assignmentId } });
  if (!assignment) throw new Error("Assignment not found.");
  return prisma.hostelBedAssignment.update({ where: { id: assignmentId }, data: { endedAt: new Date() } });
}
