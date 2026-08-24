import { prisma } from "./db";

const RECENT_LIMIT = 20;

export async function getRecentNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: RECENT_LIMIT }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { notifications, unreadCount };
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
