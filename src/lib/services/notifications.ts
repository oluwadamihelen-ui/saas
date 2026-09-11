import "server-only";
import { prisma } from "@/lib/db";
import type { NotificationType, NotificationCategory, NotificationPriority, Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import type { ActionItem, ActionPriority } from "@/lib/services/school-health/types";

/// Sort weight for the bell/notifications page — lower sorts first
/// (CRITICAL always surfaces above HIGH, etc.), never by recency alone.
export const NOTIFICATION_PRIORITY_ORDER: Record<NotificationPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/// Categories a user can never mute in-app (brief section 22: "some
/// critical school/system notifications may not be suppressible") — trial,
/// subscription, and student-limit state, which the school owner/admin
/// must always see regardless of their own notification preferences.
const NON_SUPPRESSIBLE_CATEGORIES: ReadonlySet<NotificationCategory> = new Set(["SYSTEM"]);

export function isCategorySuppressible(category: NotificationCategory): boolean {
  return !NON_SUPPRESSIBLE_CATEGORIES.has(category);
}

export async function listNotifications(schoolId: string, userId: string, take = 30) {
  return prisma.notification.findMany({
    where: { schoolId, userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/// Paginated variant for the full /notifications page (brief section 29:
/// "never load thousands into the browser"). filters.category/priority
/// narrow the where clause server-side; filters.unreadOnly does the same
/// for readAt. Expired notifications are excluded unless
/// includeExpired is true, so the default list never shows a stale
/// live-class reminder or a birthday that already passed.
export interface NotificationListFilters {
  category?: NotificationCategory | NotificationCategory[];
  priority?: NotificationPriority | NotificationPriority[];
  unreadOnly?: boolean;
  search?: string;
  includeExpired?: boolean;
}

export async function listNotificationsPage(
  schoolId: string,
  userId: string,
  filters: NotificationListFilters = {},
  page = 1,
  pageSize = 20
) {
  const now = new Date();
  const where: Prisma.NotificationWhereInput = {
    schoolId,
    userId,
    category: Array.isArray(filters.category) ? { in: filters.category } : filters.category,
    priority: Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority,
    readAt: filters.unreadOnly ? null : undefined,
    ...(filters.includeExpired ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }),
    ...(filters.search
      ? {
          AND: [
            {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" } },
                { body: { contains: filters.search, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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

export async function deleteNotification(schoolId: string, userId: string, id: string) {
  return prisma.notification.deleteMany({ where: { schoolId, userId, id } });
}

export async function hasExpiredNotifications(schoolId: string, userId: string): Promise<boolean> {
  const count = await prisma.notification.count({ where: { schoolId, userId, expiresAt: { lt: new Date() } } });
  return count > 0;
}

/// Removes this user's own already-expired notifications (brief section
/// 15: "so expired notifications don't dominate the center"). Scoped to
/// schoolId+userId like every other write here — never a school-wide or
/// cross-user delete.
export async function clearExpiredNotifications(schoolId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: { schoolId, userId, expiresAt: { lt: new Date() } },
  });
}

/// Categories with a real notify* call site behind them today — the only
/// ones offered as a preference toggle, so a user is never shown a switch
/// for a category nothing actually generates yet (brief's "do not build
/// fake settings" discipline, same as elsewhere in this app). SYSTEM is
/// deliberately excluded: it's the one NON_SUPPRESSIBLE_CATEGORIES entry,
/// so a toggle for it would do nothing.
export const PREFERENCE_TOGGLEABLE_CATEGORIES: NotificationCategory[] = [
  "ACADEMIC",
  "ATTENDANCE",
  "ASSIGNMENT",
  "EXAM",
  "RESULT",
  "FEES",
  "PAYMENT",
  "ANNOUNCEMENT",
  "ONLINE_CLASS",
  "MESSAGING",
  "BIRTHDAY",
  "AI_INSIGHT",
];

/// Every toggleable category, defaulted true for any category the user has
/// never explicitly changed — a missing NotificationPreference row means
/// "using the default", not "off".
export async function getNotificationPreferences(schoolId: string, userId: string): Promise<Record<NotificationCategory, boolean>> {
  const rows = await prisma.notificationPreference.findMany({ where: { schoolId, userId }, select: { category: true, inAppEnabled: true } });
  const overrides = new Map(rows.map((r) => [r.category, r.inAppEnabled]));
  const result = {} as Record<NotificationCategory, boolean>;
  for (const category of PREFERENCE_TOGGLEABLE_CATEGORIES) {
    result[category] = overrides.get(category) ?? true;
  }
  return result;
}

export async function setNotificationPreference(schoolId: string, userId: string, category: NotificationCategory, inAppEnabled: boolean): Promise<void> {
  if (!PREFERENCE_TOGGLEABLE_CATEGORIES.includes(category)) return;
  await prisma.notificationPreference.upsert({
    where: { userId_category: { userId, category } },
    create: { schoolId, userId, category, inAppEnabled },
    update: { inAppEnabled },
  });
}

export interface NotifyOptions {
  category: NotificationCategory;
  priority?: NotificationPriority;
  actionLabel?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  /// A deterministic key such as "assignment-created:{assignmentId}" —
  /// only the rule engine and the announcement broadcaster set this (see
  /// the Notification.dedupeKey doc comment in schema.prisma). Leave unset
  /// for one-shot event notifications, exactly as every pre-existing call
  /// below already does.
  dedupeKey?: string;
  expiresAt?: Date;
}

/// The single low-level primitive every notify* function below funnels
/// through (brief section 8's "Rule Engine -> ... -> Persist" step, for the
/// persistence half). skipDuplicates makes createMany a no-op for any
/// (userId, dedupeKey) pair that already has a row — since NULL dedupeKey
/// values are never considered equal to each other by Postgres, this is
/// invisible to every one-shot call site that doesn't pass one.
async function notifyRecipients(
  schoolId: string,
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string | undefined,
  link: string | undefined,
  options: NotifyOptions
) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;

  let recipients = uniqueIds;
  if (isCategorySuppressible(options.category)) {
    const muted = await prisma.notificationPreference.findMany({
      where: { userId: { in: uniqueIds }, category: options.category, inAppEnabled: false },
      select: { userId: true },
    });
    if (muted.length > 0) {
      const mutedIds = new Set(muted.map((m) => m.userId));
      recipients = uniqueIds.filter((id) => !mutedIds.has(id));
    }
  }
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      schoolId,
      userId,
      type,
      title,
      body,
      link,
      category: options.category,
      priority: options.priority ?? "MEDIUM",
      actionLabel: options.actionLabel,
      entityType: options.entityType,
      entityId: options.entityId,
      metadata: options.metadata,
      dedupeKey: options.dedupeKey,
      expiresAt: options.expiresAt,
    })),
    skipDuplicates: true,
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
    "/portal/parent",
    { category: "RESULT", priority: "MEDIUM", actionLabel: "View report card", entityType: "Student", entityId: studentId }
  );
}

export async function notifyPreschoolReportPublished(schoolId: string, studentId: string, termId: string) {
  const [term, recipients] = await Promise.all([
    prisma.term.findFirst({ where: { schoolId, id: termId } }),
    studentAndGuardianUserIds(schoolId, studentId),
  ]);
  await notifyRecipients(
    schoolId,
    recipients,
    "PRESCHOOL_REPORT_PUBLISHED",
    "Milestone report published",
    term ? `The developmental milestone report for ${term.name} is now available.` : undefined,
    "/portal/parent",
    { category: "RESULT", priority: "MEDIUM", actionLabel: "View report", entityType: "Student", entityId: studentId }
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
    "/portal/parent",
    { category: "FEES", priority: "MEDIUM", actionLabel: "View invoice", entityType: "Invoice", entityId: invoiceId }
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
    "/portal/parent",
    { category: "PAYMENT", priority: "INFO", entityType: "Payment", entityId: paymentId }
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
    notifyRecipients(schoolId, [...staffIds], "MESSAGE", "New message", conversation.subject, "/dashboard/messages", {
      category: "MESSAGING",
      priority: "MEDIUM",
      entityType: "Conversation",
      entityId: conversationId,
    }),
    initiatorIsPortalUser
      ? notifyRecipients(schoolId, [conversation.initiatedById], "MESSAGE", "New message", conversation.subject, initiatorLink, {
          category: "MESSAGING",
          priority: "MEDIUM",
          entityType: "Conversation",
          entityId: conversationId,
        })
      : Promise.resolve(),
  ]);
}

/// submittedById is excluded from recipients (the rare case of a staff
/// member who both submits feedback and holds feedback.view shouldn't
/// notify themselves). Recipients are whoever currently holds
/// feedback.view for this school — same "whoever has the permission
/// right now" pattern as notifyNewMessage's staff inbox, not a fixed
/// assigned reviewer.
export async function notifyNewFeedback(schoolId: string, feedbackId: string, submittedById: string) {
  const feedback = await prisma.feedback.findFirst({
    where: { schoolId, id: feedbackId },
    include: { submittedBy: true },
  });
  if (!feedback) return;

  const staffWithAccess = await prisma.user.findMany({
    where: { schoolId, role: { rolePermissions: { some: { permission: { key: "feedback.view" } } } } },
    select: { id: true },
  });
  const recipientIds = staffWithAccess.map((s) => s.id).filter((id) => id !== submittedById);

  const preview = feedback.message.length > 140 ? `${feedback.message.slice(0, 140)}…` : feedback.message;
  await notifyRecipients(
    schoolId,
    recipientIds,
    "FEEDBACK_SUBMITTED",
    `New feedback from ${feedback.submittedBy.name}`,
    preview,
    "/dashboard/administration/feedback",
    { category: "SYSTEM", priority: "LOW", entityType: "Feedback", entityId: feedbackId }
  );
}

export async function notifyAttendanceAbsent(schoolId: string, studentId: string, date: Date) {
  const recipients = await studentAndGuardianUserIds(schoolId, studentId);
  await notifyRecipients(
    schoolId,
    recipients,
    "ATTENDANCE_ABSENT",
    "Marked absent",
    `Marked absent on ${date.toLocaleDateString()}.`,
    "/portal/parent",
    { category: "ATTENDANCE", priority: "MEDIUM", entityType: "Student", entityId: studentId }
  );
}

/// Subscription/billing recipients: whoever currently holds billing.manage
/// for the school — same "whoever has the permission right now" pattern as
/// notifyNewMessage's staff inbox, not a fixed assigned owner.
async function billingManagerUserIds(schoolId: string): Promise<string[]> {
  const staff = await prisma.user.findMany({
    where: { schoolId, role: { rolePermissions: { some: { permission: { key: "billing.manage" } } } } },
    select: { id: true },
  });
  return staff.map((s) => s.id);
}

export async function notifyPlanChanged(schoolId: string, planName: string, type: "PLAN_UPGRADED" | "PLAN_DOWNGRADED") {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    type,
    type === "PLAN_UPGRADED" ? "Plan upgraded" : "Plan downgraded",
    `Your subscription is now on the ${planName} plan.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: type === "PLAN_UPGRADED" ? "INFO" : "MEDIUM" }
  );
}

export async function notifySubscriptionCancelled(schoolId: string) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "SUBSCRIPTION_CANCELLED",
    "Subscription cancelled",
    "Your Schoolum subscription has been cancelled.",
    "/dashboard/billing",
    { category: "SYSTEM", priority: "HIGH" }
  );
}

export async function notifyTrialStarted(schoolId: string, trialEnd: Date) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "TRIAL_STARTED",
    "Your trial has started",
    `You have full access to Professional-tier features until ${trialEnd.toLocaleDateString()}.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "INFO" }
  );
}

export async function notifyTrialEndingSoon(schoolId: string, trialEnd: Date) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "TRIAL_ENDING_SOON",
    "Your trial is ending soon",
    `Your trial ends on ${trialEnd.toLocaleDateString()}. Choose a plan to keep uninterrupted access.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "HIGH", actionLabel: "Choose a plan" }
  );
}

export async function notifyTrialExpired(schoolId: string) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "TRIAL_EXPIRED",
    "Your trial has ended",
    "Choose a plan to restore full access to your school's account.",
    "/dashboard/billing",
    { category: "SYSTEM", priority: "HIGH", actionLabel: "Choose a plan" }
  );
}

export async function notifySubscriptionPaymentSuccess(schoolId: string, planName: string) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "SUBSCRIPTION_PAYMENT_SUCCESS",
    "Payment received",
    `Your payment for the ${planName} plan was successful.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "INFO" }
  );
}

export async function notifySubscriptionPaymentFailed(schoolId: string, planName: string) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "SUBSCRIPTION_PAYMENT_FAILED",
    "Payment failed",
    `We couldn't process your payment for the ${planName} plan. Please update your payment details.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "HIGH", actionLabel: "Update payment details" }
  );
}

export async function notifySubscriptionRenewed(schoolId: string, planName: string) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "SUBSCRIPTION_RENEWED",
    "Subscription renewed",
    `Your ${planName} subscription has been renewed.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "INFO" }
  );
}

export async function notifyStudentLimitApproaching(schoolId: string, current: number, limit: number) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "STUDENT_LIMIT_APPROACHING",
    "Approaching student limit",
    `You have ${current} of ${limit} students on your current plan.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "MEDIUM" }
  );
}

export async function notifyStudentLimitReached(schoolId: string, limit: number) {
  const recipients = await billingManagerUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "STUDENT_LIMIT_REACHED",
    "Student limit reached",
    `Your plan supports up to ${limit} students. Upgrade to add more.`,
    "/dashboard/billing",
    { category: "SYSTEM", priority: "HIGH", actionLabel: "Upgrade plan" }
  );
}

/// requireStudentCapacity (entitlements.ts) calls this every time an
/// enrollment is blocked — which, unlike a one-time status transition,
/// can happen repeatedly (a school retrying, or several staff hitting the
/// same limit). Without a dedicated "already notified" flag on the
/// subscription, this checks the Notification table itself for one already
/// sent today rather than send one on every single blocked attempt.
export async function notifyStudentLimitReachedOnce(schoolId: string, limit: number) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const alreadySent = await prisma.notification.findFirst({
    where: { schoolId, type: "STUDENT_LIMIT_REACHED", createdAt: { gte: since } },
  });
  if (alreadySent) return;
  await notifyStudentLimitReached(schoolId, limit);
}

export async function notifyCbtExamSubmitted(schoolId: string, studentId: string, examTitle: string) {
  const recipients = await studentAndGuardianUserIds(schoolId, studentId);
  await notifyRecipients(
    schoolId,
    recipients,
    "CBT_EXAM_SUBMITTED",
    "Exam submitted",
    `"${examTitle}" has been submitted successfully.`,
    undefined,
    { category: "EXAM", priority: "INFO" }
  );
}

/// Same "whoever holds the permission right now" pattern as
/// billingManagerUserIds — cbt.grade is a role-assigned permission
/// (PRINCIPAL/TEACHER by default, see permissions.ts), not a fixed owner
/// per exam.
async function cbtGradersUserIds(schoolId: string): Promise<string[]> {
  const staff = await prisma.user.findMany({
    where: { schoolId, role: { rolePermissions: { some: { permission: { key: "cbt.grade" } } } } },
    select: { id: true },
  });
  return staff.map((s) => s.id);
}

export async function notifyCbtManualGradingRequired(schoolId: string, examId: string, examTitle: string) {
  const recipients = await cbtGradersUserIds(schoolId);
  await notifyRecipients(
    schoolId,
    recipients,
    "CBT_MANUAL_GRADING_REQUIRED",
    "Manual grading needed",
    `"${examTitle}" has answers waiting to be graded.`,
    `/dashboard/cbt/grading?examId=${examId}`,
    { category: "EXAM", priority: "MEDIUM", actionLabel: "Grade now", entityType: "CBTExam", entityId: examId }
  );
}

export async function notifyCbtResultAvailable(schoolId: string, studentId: string, examTitle: string) {
  const recipients = await studentAndGuardianUserIds(schoolId, studentId);
  await notifyRecipients(schoolId, recipients, "CBT_RESULT_AVAILABLE", "Result available", `Your result for "${examTitle}" is ready.`, undefined, {
    category: "EXAM",
    priority: "MEDIUM",
  });
}

/// Every student (and their linked guardians) currently enrolled in a
/// classArm — the recipient set for anything scoped to a whole class rather
/// than one student, same shape as announcements.ts's CLASS-audience
/// resolution. Silently skips anyone without a portal account yet, same
/// as studentAndGuardianUserIds above.
async function classArmStudentAndGuardianUserIds(schoolId: string, classArmId: string): Promise<{ studentUserIds: string[]; guardianUserIds: string[] }> {
  const students = await prisma.student.findMany({
    where: { schoolId, classArmId, status: "ACTIVE" },
    include: { guardians: { include: { guardian: true } } },
  });
  const studentUserIds: string[] = [];
  const guardianUserIds: string[] = [];
  for (const student of students) {
    if (student.userId) studentUserIds.push(student.userId);
    for (const sg of student.guardians) {
      if (sg.guardian.userId) guardianUserIds.push(sg.guardian.userId);
    }
  }
  return { studentUserIds, guardianUserIds };
}

export async function notifyLecturePublished(schoolId: string, lectureId: string) {
  const lecture = await prisma.lecture.findFirst({ where: { schoolId, id: lectureId }, include: { subject: true } });
  if (!lecture) return;
  const { studentUserIds, guardianUserIds } = await classArmStudentAndGuardianUserIds(schoolId, lecture.classArmId);
  await Promise.all([
    notifyRecipients(
      schoolId,
      studentUserIds,
      "LECTURE_PUBLISHED",
      "New lecture available",
      `"${lecture.title}" (${lecture.subject.name}) is ready to study.`,
      "/portal/student/online-learning",
      { category: "ONLINE_CLASS", priority: "LOW", entityType: "Lecture", entityId: lectureId }
    ),
    notifyRecipients(
      schoolId,
      guardianUserIds,
      "LECTURE_PUBLISHED",
      "New lecture published",
      `"${lecture.title}" (${lecture.subject.name}) was published for your child's class.`,
      undefined,
      { category: "ONLINE_CLASS", priority: "LOW", entityType: "Lecture", entityId: lectureId }
    ),
  ]);
}

export async function notifyLiveClassScheduled(schoolId: string, liveClassId: string) {
  const liveClass = await prisma.liveClass.findFirst({ where: { schoolId, id: liveClassId }, include: { subject: true } });
  if (!liveClass) return;
  const { studentUserIds, guardianUserIds } = await classArmStudentAndGuardianUserIds(schoolId, liveClass.classArmId);
  const when = liveClass.scheduledStart.toLocaleString();
  await Promise.all([
    notifyRecipients(
      schoolId,
      studentUserIds,
      "LIVE_CLASS_SCHEDULED",
      "Live class scheduled",
      `${liveClass.subject.name}: "${liveClass.title}" on ${when}.`,
      "/portal/student/online-learning/live-classes",
      { category: "ONLINE_CLASS", priority: "LOW", entityType: "LiveClass", entityId: liveClassId }
    ),
    notifyRecipients(
      schoolId,
      guardianUserIds,
      "LIVE_CLASS_SCHEDULED",
      "Live class scheduled",
      `${liveClass.subject.name}: "${liveClass.title}" on ${when}.`,
      undefined,
      { category: "ONLINE_CLASS", priority: "LOW", entityType: "LiveClass", entityId: liveClassId }
    ),
  ]);
}

export async function notifyLiveClassStarted(schoolId: string, liveClassId: string) {
  const liveClass = await prisma.liveClass.findFirst({ where: { schoolId, id: liveClassId }, include: { subject: true } });
  if (!liveClass) return;
  const { studentUserIds } = await classArmStudentAndGuardianUserIds(schoolId, liveClass.classArmId);
  await notifyRecipients(
    schoolId,
    studentUserIds,
    "LIVE_CLASS_STARTED",
    "Your live class has started",
    `${liveClass.subject.name}: "${liveClass.title}" is live now.`,
    `/portal/student/online-learning/live-classes/${liveClass.id}`,
    { category: "ONLINE_CLASS", priority: "HIGH", actionLabel: "Join now", entityType: "LiveClass", entityId: liveClassId }
  );
}

export async function notifyLiveClassCancelled(schoolId: string, liveClassId: string) {
  const liveClass = await prisma.liveClass.findFirst({ where: { schoolId, id: liveClassId }, include: { subject: true } });
  if (!liveClass) return;
  const { studentUserIds, guardianUserIds } = await classArmStudentAndGuardianUserIds(schoolId, liveClass.classArmId);
  await notifyRecipients(
    schoolId,
    [...studentUserIds, ...guardianUserIds],
    "LIVE_CLASS_CANCELLED",
    "Live class cancelled",
    `${liveClass.subject.name}: "${liveClass.title}" has been cancelled.`,
    undefined,
    { category: "ONLINE_CLASS", priority: "MEDIUM", entityType: "LiveClass", entityId: liveClassId }
  );
}

export async function notifyLiveClassRecordingAvailable(schoolId: string, lectureId: string) {
  const lecture = await prisma.lecture.findFirst({ where: { schoolId, id: lectureId }, include: { subject: true } });
  if (!lecture) return;
  const { studentUserIds } = await classArmStudentAndGuardianUserIds(schoolId, lecture.classArmId);
  await notifyRecipients(
    schoolId,
    studentUserIds,
    "LIVE_CLASS_RECORDING_AVAILABLE",
    "Class recording available",
    `The recording for "${lecture.title}" (${lecture.subject.name}) is ready to watch.`,
    "/portal/student/online-learning",
    { category: "ONLINE_CLASS", priority: "LOW", entityType: "Lecture", entityId: lectureId }
  );
}

/// Live class starting within the next N minutes (brief section 4's
/// example: "online class starts in 30 minutes"). Deduped per class per
/// day (a class starting soon is only ever "starting soon" once) and
/// expires the moment the class actually starts, so it never lingers in
/// the center once it's no longer true. Called by the rule engine, not by
/// any live-class CRUD event — this is a time-based check, not a
/// create/update.
export async function notifyLiveClassStartingSoon(schoolId: string, liveClassId: string, minutesUntilStart: number) {
  const liveClass = await prisma.liveClass.findFirst({ where: { schoolId, id: liveClassId }, include: { subject: true } });
  if (!liveClass) return;
  const { studentUserIds } = await classArmStudentAndGuardianUserIds(schoolId, liveClass.classArmId);
  await notifyRecipients(
    schoolId,
    studentUserIds,
    "LIVE_CLASS_STARTING_SOON",
    "Online class starting soon",
    `${liveClass.subject.name}: "${liveClass.title}" starts in ${minutesUntilStart} minutes.`,
    `/portal/student/online-learning/live-classes/${liveClass.id}`,
    {
      category: "ONLINE_CLASS",
      priority: "HIGH",
      actionLabel: "Join",
      entityType: "LiveClass",
      entityId: liveClassId,
      dedupeKey: `live-class-starting-soon:${liveClassId}`,
      expiresAt: liveClass.scheduledStart,
    }
  );
}

/// Assignment created — students and guardians of the assigned class (brief
/// section 4's teacher/student examples). Deduped per assignment (a
/// created assignment is only ever "new" once) and expires at the due date,
/// so a long-overdue assignment eventually stops cluttering the center.
export async function notifyAssignmentCreated(schoolId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({ where: { schoolId, id: assignmentId }, include: { subject: true } });
  if (!assignment) return;
  const { studentUserIds, guardianUserIds } = await classArmStudentAndGuardianUserIds(schoolId, assignment.classArmId);
  const due = assignment.dueDate.toLocaleDateString();
  await Promise.all([
    notifyRecipients(
      schoolId,
      studentUserIds,
      "ASSIGNMENT_CREATED",
      "New assignment",
      `${assignment.subject.name}: "${assignment.title}" is due ${due}.`,
      "/portal/student/assignments",
      {
        category: "ASSIGNMENT",
        priority: "MEDIUM",
        actionLabel: "View assignment",
        entityType: "Assignment",
        entityId: assignmentId,
        dedupeKey: `assignment-created:${assignmentId}`,
        expiresAt: assignment.dueDate,
      }
    ),
    notifyRecipients(
      schoolId,
      guardianUserIds,
      "ASSIGNMENT_CREATED",
      "New assignment",
      `${assignment.subject.name}: "${assignment.title}" is due ${due}.`,
      undefined,
      {
        category: "ASSIGNMENT",
        priority: "LOW",
        entityType: "Assignment",
        entityId: assignmentId,
        dedupeKey: `assignment-created:${assignmentId}`,
        expiresAt: assignment.dueDate,
      }
    ),
  ]);
}

/// Assignment graded — the submitting student and their guardians. Deduped
/// per submission so re-grading the same submission (a score correction)
/// doesn't spam a second notification.
export async function notifyAssignmentGraded(schoolId: string, submissionId: string) {
  const submission = await prisma.assignmentSubmission.findFirst({
    where: { id: submissionId, assignment: { schoolId } },
    include: { assignment: { include: { subject: true } } },
  });
  if (!submission) return;
  const recipients = await studentAndGuardianUserIds(schoolId, submission.studentId);
  const scoreText = submission.score !== null ? ` Score: ${submission.score}.` : "";
  await notifyRecipients(
    schoolId,
    recipients,
    "ASSIGNMENT_GRADED",
    "Assignment graded",
    `${submission.assignment.subject.name}: "${submission.assignment.title}" has been graded.${scoreText}`,
    "/portal/student/assignments",
    {
      category: "ASSIGNMENT",
      priority: "LOW",
      actionLabel: "View feedback",
      entityType: "AssignmentSubmission",
      entityId: submissionId,
      dedupeKey: `assignment-graded:${submissionId}`,
    }
  );
}

// ---------------------------------------------------------------------
// Notification Rule Engine outputs (src/lib/services/notification-rules.ts
// calls these). These are the "is this true right now" -> "generate a
// notification" step of the brief's "School Event -> Rule Engine ->
// Determine affected users -> Determine priority -> Generate -> Dedupe ->
// Persist" pipeline; the rule engine itself decides WHO and WHETHER, these
// functions decide the exact notification SHAPE for that rule (same
// division of labor as every notify* function above).
// ---------------------------------------------------------------------

const ACTION_PRIORITY_TO_NOTIFICATION_PRIORITY: Record<ActionPriority, NotificationPriority> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  INFORMATIONAL: "INFO",
};

const ACTION_CATEGORY_TO_NOTIFICATION_CATEGORY: Record<ActionItem["category"], NotificationCategory> = {
  academic: "ACADEMIC",
  attendance: "ATTENDANCE",
  financial: "FEES",
  operational: "SYSTEM",
};

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function endOfToday(now: Date): Date {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/// Surfaces the School Health Dashboard's own Action Center as
/// notifications for whoever holds the same academics.manage +
/// finance.view access the dashboard itself requires (brief section 27:
/// never a wider audience than the data's own access gate) — never a
/// second, independently-computed set of "things needing attention".
/// One notification per item, deduped per item per day so a still-true
/// condition resurfaces daily rather than nagging on every page load, and
/// naturally drops off the list once no longer true (a fresh scan simply
/// stops regenerating it) or once the day ends (expiresAt).
export async function notifyAdminActionItems(schoolId: string, recipientUserIds: string[], items: ActionItem[], now: Date = new Date()) {
  if (recipientUserIds.length === 0 || items.length === 0) return;
  const dayKey = now.toISOString().slice(0, 10);
  const expiresAt = endOfToday(now);
  await Promise.all(
    items.map((item) =>
      notifyRecipients(schoolId, recipientUserIds, "ADMIN_ACTION_ITEM", item.title, `${item.description} (${item.metric})`, item.href, {
        category: ACTION_CATEGORY_TO_NOTIFICATION_CATEGORY[item.category],
        priority: ACTION_PRIORITY_TO_NOTIFICATION_PRIORITY[item.priority],
        actionLabel: "View details",
        dedupeKey: `admin-action:${slugify(item.title)}:${dayKey}`,
        expiresAt,
      })
    )
  );
}

/// One digest notification ("2 birthdays today, 1 tomorrow"), never one
/// notification per person — brief section 25's "smart digesting". Only
/// sent to whoever holds birthdays.view (the same permission the Birthday
/// Directory page itself requires), and only when there is at least one
/// birthday to report (brief section 24: "only sent if there's something
/// meaningful to report").
export async function notifyBirthdaysDigest(schoolId: string, recipientUserIds: string[], todayCount: number, tomorrowCount: number, now: Date = new Date()) {
  if (recipientUserIds.length === 0 || (todayCount === 0 && tomorrowCount === 0)) return;
  const parts: string[] = [];
  if (todayCount > 0) parts.push(`${todayCount} birthday${todayCount === 1 ? "" : "s"} today`);
  if (tomorrowCount > 0) parts.push(`${tomorrowCount} birthday${tomorrowCount === 1 ? "" : "s"} tomorrow`);
  const dayKey = now.toISOString().slice(0, 10);
  await notifyRecipients(schoolId, recipientUserIds, "BIRTHDAY_UPCOMING", parts.join(" and "), undefined, "/dashboard/birthdays", {
    category: "BIRTHDAY",
    priority: "INFO",
    actionLabel: "View birthdays",
    dedupeKey: `birthdays-digest:${dayKey}`,
    expiresAt: endOfToday(now),
  });
}

/// Teacher-only, scoped to their own assignments (never another teacher's
/// gradebook) — brief section 4's "12 assignments waiting to be graded".
export async function notifyAssignmentGradingPending(schoolId: string, teacherId: string, pendingCount: number, now: Date = new Date()) {
  if (pendingCount === 0) return;
  const dayKey = now.toISOString().slice(0, 10);
  await notifyRecipients(
    schoolId,
    [teacherId],
    "ASSIGNMENT_GRADING_PENDING",
    "Assignments waiting to be graded",
    `${pendingCount} submission${pendingCount === 1 ? "" : "s"} waiting for grading.`,
    "/dashboard/assignments",
    {
      category: "ASSIGNMENT",
      priority: "MEDIUM",
      actionLabel: "Grade now",
      dedupeKey: `assignment-grading-pending:${teacherId}:${dayKey}`,
      expiresAt: endOfToday(now),
    }
  );
}

/// Teacher-only — a class/subject they're assigned to with zero scores
/// recorded this term (brief section 10's "teacher-incomplete-results"
/// rule), deliberately phrased around "no scores entered" rather than a
/// fabricated submission deadline, since this schema has no explicit
/// per-teacher result-submission-due-date field. Re-derived (and
/// re-deduped) weekly so a still-incomplete class resurfaces without
/// nagging daily, and expires after a week so it never becomes permanent
/// once actually resolved.
export async function notifyTeacherScoresPending(schoolId: string, teacherId: string, termId: string, missingCount: number, now: Date = new Date()) {
  if (missingCount === 0) return;
  const weekKey = isoWeekKey(now);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await notifyRecipients(
    schoolId,
    [teacherId],
    "TEACHER_SCORES_PENDING",
    "Scores not yet entered",
    `You have ${missingCount} class${missingCount === 1 ? "" : "es"}/subject${missingCount === 1 ? "" : "s"} with no scores entered yet this term.`,
    "/dashboard/results",
    {
      category: "RESULT",
      priority: "MEDIUM",
      actionLabel: "Enter scores",
      dedupeKey: `teacher-scores-pending:${teacherId}:${termId}:${weekKey}`,
      expiresAt,
    }
  );
}

/// Parent-only, scoped to exactly this guardian and exactly this one
/// child — brief section 27's explicit "a parent must NEVER see total
/// school outstanding fees, only their own child's". Re-derived weekly.
export async function notifyParentFeesOutstanding(
  schoolId: string,
  guardianUserId: string,
  studentId: string,
  studentName: string,
  outstandingMinor: number,
  currency: string,
  now: Date = new Date()
) {
  if (outstandingMinor <= 0) return;
  const weekKey = isoWeekKey(now);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await notifyRecipients(
    schoolId,
    [guardianUserId],
    "FEES_OUTSTANDING",
    "School fees payment due",
    `${studentName} has ${formatMoney(outstandingMinor, currency)} outstanding.`,
    `/portal/parent/children/${studentId}`,
    {
      category: "FEES",
      priority: "MEDIUM",
      actionLabel: "Pay now",
      entityType: "Student",
      entityId: studentId,
      dedupeKey: `parent-fees-outstanding:${guardianUserId}:${studentId}:${weekKey}`,
      expiresAt,
    }
  );
}

/// Parent-only, scoped to exactly this guardian and exactly this one
/// child's own attendance rate — never a school-wide attendance alert.
export async function notifyParentAttendanceConcern(
  schoolId: string,
  guardianUserId: string,
  studentId: string,
  studentName: string,
  attendanceRatePercent: number,
  termId: string,
  now: Date = new Date()
) {
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await notifyRecipients(
    schoolId,
    [guardianUserId],
    "ATTENDANCE_CONCERN",
    "Attendance concern",
    `${studentName}'s attendance this term is ${attendanceRatePercent}%, below the school's expected level.`,
    `/portal/parent/children/${studentId}`,
    {
      category: "ATTENDANCE",
      priority: "MEDIUM",
      entityType: "Student",
      entityId: studentId,
      dedupeKey: `parent-attendance-concern:${guardianUserId}:${studentId}:${termId}`,
      expiresAt,
    }
  );
}

/// Student-only, scoped to their own pending submissions in their own
/// class — brief section 4's "assignment due tomorrow" example.
export async function notifyStudentAssignmentDueSoon(schoolId: string, studentUserId: string, count: number, dueToday: boolean, now: Date = new Date()) {
  if (count === 0) return;
  const dayKey = now.toISOString().slice(0, 10);
  await notifyRecipients(
    schoolId,
    [studentUserId],
    "ASSIGNMENT_DUE_SOON",
    dueToday ? "Assignment due today" : "Assignment due soon",
    `You have ${count} assignment${count === 1 ? "" : "s"} due ${dueToday ? "today" : "soon"}.`,
    "/portal/student/assignments",
    {
      category: "ASSIGNMENT",
      priority: dueToday ? "HIGH" : "MEDIUM",
      actionLabel: "View assignments",
      dedupeKey: `student-assignment-due-soon:${studentUserId}:${dayKey}`,
      expiresAt: endOfToday(now),
    }
  );
}

/// ISO 8601 week number (Monday-start, per the standard) — used only to
/// bucket "re-check weekly" dedupeKeys, never displayed to a user, so the
/// standard's exact edge-case behavior around year boundaries doesn't
/// need to be user-facing-correct, only stable and monotonic in practice.
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
