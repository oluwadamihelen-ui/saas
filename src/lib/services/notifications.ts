import { prisma } from "@/lib/db";
import type { RoleKey } from "@/generated/prisma/enums";
import { sendEmail } from "@/lib/email/brevo";
import { renderNotificationEmail } from "@/lib/email/template";

interface NotifyInput {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

function emailRecipients(users: { email: string; name: string }[]) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return { appUrl, to: users.map((u) => ({ email: u.email, name: u.name })) };
}

async function dispatchEmail(users: { email: string; name: string }[], input: NotifyInput) {
  if (users.length === 0) return;
  const { appUrl, to } = emailRecipients(users);
  // Best-effort, fire-and-forget from the caller's perspective in spirit,
  // but actually awaited here with sendEmail's own internal timeout+fail-open
  // so it never throws -- awaiting (rather than a true detached background
  // job) is deliberate: this app has no guaranteed always-on worker process
  // in production, so "queue it for later" could mean "never sent".
  await sendEmail({
    to,
    subject: input.title,
    html: renderNotificationEmail({ title: input.title, message: input.message, appUrl }),
    text: input.message,
  });
}

export async function notifyUser(hotelId: string | null, userId: string, input: NotifyInput) {
  const [user] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    prisma.notification.create({
      data: { hotelId, userId, type: input.type, channel: "IN_APP", title: input.title, message: input.message, data: input.data as never },
    }),
  ]);
  if (user?.email) await dispatchEmail([{ email: user.email, name: user.name }], input);
}

/**
 * Broadcasts a notification -- both in-app and, when Brevo is configured
 * (BREVO_API_KEY set), by email -- to every active staff member holding one
 * of the given roles at a hotel (defaults to the roles who actually need to
 * act on day-to-day operational events: owner, manager, receptionist).
 */
export async function notifyHotelStaff(hotelId: string, input: NotifyInput, roles: RoleKey[] = ["HOTEL_OWNER", "HOTEL_MANAGER", "RECEPTIONIST"]) {
  const members = await prisma.hotelMember.findMany({
    where: { hotelId, employmentStatus: "ACTIVE", role: { in: roles } },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  if (members.length === 0) return;

  await prisma.notification.createMany({
    data: members.map((m) => ({ hotelId, userId: m.user.id, type: input.type, channel: "IN_APP" as const, title: input.title, message: input.message, data: input.data as never })),
  });

  const withEmail = members.filter((m): m is typeof m & { user: { email: string } } => Boolean(m.user.email)).map((m) => ({ email: m.user.email, name: m.user.name }));
  await dispatchEmail(withEmail, input);
}

/** Sends a one-off email tied to a specific user's account event (welcome, password changed) without creating an in-app notification row. */
export async function emailUser(user: { email: string; name: string }, input: NotifyInput) {
  await dispatchEmail([user], input);
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
