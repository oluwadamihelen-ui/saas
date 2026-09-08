import "server-only";
import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";

export async function listNotifications(schoolId: string, userId: string, take = 30) {
  return prisma.notification.findMany({
    where: { schoolId, userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadNotificationCount(schoolId: string, userId: string) {
  return prisma.notification.count({ where: { schoolId, userId, readAt: null } });
}

export async function markNotificationRead(schoolId: string, userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { schoolId, userId, id },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(schoolId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { schoolId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

async function notifyRecipients(
  schoolId: string,
  userIds: string[],
  type: NotificationType,
  title: string,
  body?: string,
  link?: string
) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({ schoolId, userId, type, title, body, link })),
  });
}

/// The recipients for anything about a specific student: the student's own
/// portal account (if they have one) plus every linked guardian's portal
/// account (if they have one) — silently a no-op for students whose family
/// hasn't accepted a portal invite yet, same as StaffInvite links being
/// unreachable until accepted.
async function studentAndGuardianUserIds(schoolId: string, studentId: string): Promise<string[]> {
  const student = await prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { guardians: { include: { guardian: true } } },
  });
  if (!student) return [];
  const ids: string[] = [];
  if (student.userId) ids.push(student.userId);
  for (const sg of student.guardians) {
    if (sg.guardian.userId) ids.push(sg.guardian.userId);
  }
  return ids;
}

export async function notifyReportCardPublished(schoolId: string, studentId: string, termId: string) {
  const [term, recipients] = await Promise.all([
    prisma.term.findFirst({ where: { schoolId, id: termId } }),
    studentAndGuardianUserIds(schoolId, studentId),
  ]);
  await notifyRecipients(
    schoolId,
    recipients,
    "REPORT_CARD_PUBLISHED",
    "Report card published",
    term ? `The report card for ${term.name} is now available.` : undefined,
    "/portal/parent"
  );
}

export async function notifyInvoiceIssued(schoolId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { schoolId, id: invoiceId } });
  if (!invoice) return;
  const recipients = await studentAndGuardianUserIds(schoolId, invoice.studentId);
  await notifyRecipients(
    schoolId,
    recipients,
    "INVOICE_ISSUED",
    "New invoice issued",
    `Invoice ${invoice.invoiceNumber} has been issued.`,
    "/portal/parent"
  );
}

export async function notifyPaymentConfirmed(schoolId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({ where: { schoolId, id: paymentId }, include: { invoice: true } });
  if (!payment) return;
  const recipients = await studentAndGuardianUserIds(schoolId, payment.invoice.studentId);
  await notifyRecipients(
    schoolId,
    recipients,
    "PAYMENT_CONFIRMED",
    "Payment confirmed",
    `A payment against invoice ${payment.invoice.invoiceNumber} has been confirmed.`,
    "/portal/parent"
  );
}

/// senderId is excluded from recipients so a reply never notifies its own
/// author. Staff recipients are whoever currently holds messages.view for
/// this school (an admin-office inbox, not one assigned staff member), so
/// this stays correct if a school's own role/permission matrix changes.
export async function notifyNewMessage(schoolId: string, conversationId: string, senderId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { schoolId, id: conversationId },
    include: { initiatedBy: { include: { role: true } } },
  });
  if (!conversation) return;

  const staffWithAccess = await prisma.user.findMany({
    where: { schoolId, role: { rolePermissions: { some: { permission: { key: "messages.view" } } } } },
    select: { id: true },
  });
  const staffIds = new Set(staffWithAccess.map((s) => s.id));
  staffIds.delete(senderId);

  const initiatorIsPortalUser =
    conversation.initiatedById !== senderId &&
    (conversation.initiatedBy.role.key === "PARENT" || conversation.initiatedBy.role.key === "STUDENT");
  const initiatorLink = conversation.initiatedBy.role.key === "STUDENT" ? "/portal/student/messages" : "/portal/parent/messages";

  await Promise.all([
    notifyRecipients(schoolId, [...staffIds], "MESSAGE", "New message", conversation.subject, "/dashboard/messages"),
    initiatorIsPortalUser
      ? notifyRecipients(schoolId, [conversation.initiatedById], "MESSAGE", "New message", conversation.subject, initiatorLink)
      : Promise.resolve(),
  ]);
}

export async function notifyAttendanceAbsent(schoolId: string, studentId: string, date: Date) {
  const recipients = await studentAndGuardianUserIds(schoolId, studentId);
  await notifyRecipients(
    schoolId,
    recipients,
    "ATTENDANCE_ABSENT",
    "Marked absent",
    `Marked absent on ${date.toLocaleDateString()}.`,
    "/portal/parent"
  );
}
