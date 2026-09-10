import { prisma } from "@/lib/db";
import type { RoleKey } from "@/generated/prisma/enums";

interface NotifyInput {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function notifyUser(hotelId: string | null, userId: string, input: NotifyInput) {
  await prisma.notification.create({
    data: { hotelId, userId, type: input.type, channel: "IN_APP", title: input.title, message: input.message, data: input.data as never },
  });
}

/**
 * Broadcasts an in-app notification to every active staff member holding
 * one of the given roles at a hotel (defaults to the roles who actually
 * need to act on day-to-day operational events: owner, manager,
 * receptionist). Real email/SMS delivery is a documented future addition
 * (see ARCHITECTURE.md) -- in-app is real and functional today.
 */
export async function notifyHotelStaff(hotelId: string, input: NotifyInput, roles: RoleKey[] = ["HOTEL_OWNER", "HOTEL_MANAGER", "RECEPTIONIST"]) {
  const members = await prisma.hotelMember.findMany({
    where: { hotelId, employmentStatus: "ACTIVE", role: { in: roles } },
    select: { userId: true },
  });
  if (members.length === 0) return;

  await prisma.notification.createMany({
    data: members.map((m) => ({ hotelId, userId: m.userId, type: input.type, channel: "IN_APP" as const, title: input.title, message: input.message, data: input.data as never })),
  });
}

export async function listNotifications(userId: string, unreadOnly = false, take = 30) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
