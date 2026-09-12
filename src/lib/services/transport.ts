import "server-only";
import { prisma } from "@/lib/db";

export async function listVehicles(schoolId: string) {
  return prisma.vehicle.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export interface VehicleInput {
  name: string;
  plateNumber: string;
  capacity: number;
  driverName?: string | null;
  driverPhone?: string | null;
}

export async function createVehicle(schoolId: string, input: VehicleInput) {
  return prisma.vehicle.create({ data: { schoolId, ...input } });
}

export async function listRoutes(schoolId: string) {
  return prisma.transportRoute.findMany({
    where: { schoolId },
    include: { vehicle: true, _count: { select: { assignments: { where: { endedAt: null } }, stops: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getRoute(schoolId: string, id: string) {
  return prisma.transportRoute.findFirst({
    where: { schoolId, id },
    include: {
      vehicle: true,
      stops: { orderBy: { order: "asc" } },
      assignments: {
        where: { endedAt: null },
        include: { student: true, stop: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });
}

export async function createRoute(schoolId: string, name: string, vehicleId?: string | null) {
  return prisma.transportRoute.create({ data: { schoolId, name, vehicleId: vehicleId || null } });
}

export async function addRouteStop(schoolId: string, routeId: string, name: string, order: number, pickupTime?: string | null, dropoffTime?: string | null) {
  const route = await prisma.transportRoute.findFirst({ where: { id: routeId, schoolId } });
  if (!route) throw new Error("Route not found.");
  return prisma.routeStop.create({ data: { schoolId, routeId, name, order, pickupTime: pickupTime || null, dropoffTime: dropoffTime || null } });
}

/// Ends any existing active assignment for this student first — one active
/// route assignment per student, enforced here rather than a DB constraint.
export async function assignStudentToRoute(schoolId: string, studentId: string, routeId: string, stopId?: string | null) {
  const route = await prisma.transportRoute.findFirst({ where: { id: routeId, schoolId } });
  if (!route) throw new Error("Route not found.");

  await prisma.studentTransportAssignment.updateMany({
    where: { schoolId, studentId, endedAt: null },
    data: { endedAt: new Date() },
  });

  return prisma.studentTransportAssignment.create({
    data: { schoolId, studentId, routeId, stopId: stopId || null },
  });
}

export async function unassignStudentFromRoute(schoolId: string, assignmentId: string) {
  const assignment = await prisma.studentTransportAssignment.findFirst({ where: { schoolId, id: assignmentId } });
  if (!assignment) throw new Error("Assignment not found.");
  return prisma.studentTransportAssignment.update({ where: { id: assignmentId }, data: { endedAt: new Date() } });
}
