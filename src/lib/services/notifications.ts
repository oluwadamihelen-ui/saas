import { prisma } from "@/lib/db";
import { getEmailProvider } from "@/lib/providers/registry";

interface NotifyInput {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
}

export async function notifyUser(userId: string, input: NotifyInput) {
  await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      channel: "IN_APP",
      title: input.title,
      message: input.message,
      data: input.data as never,
    },
  });

  if (input.sendEmail !== false) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const provider = await getEmailProvider();
      await provider.send({
        to: user.email,
        subject: input.title,
        html: `<p>${input.message}</p>`,
        text: input.message,
      });
    }
  }
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}
