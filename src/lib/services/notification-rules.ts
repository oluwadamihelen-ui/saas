import "server-only";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getCurrentTerm } from "@/lib/services/academics";
import { getSchoolHealthDashboard } from "@/lib/services/school-health/analysis";
import { listBirthdays } from "@/lib/services/birthdays";
import {
  notifyAdminActionItems,
  notifyBirthdaysDigest,
  notifyAssignmentGradingPending,
  notifyTeacherScoresPending,
  notifyParentFeesOutstanding,
  notifyParentAttendanceConcern,
  notifyStudentAssignmentDueSoon,
  notifyLiveClassStartingSoon,
} from "@/lib/services/notifications";

/// How long a rule scan's results are trusted before the next request
/// triggers a fresh one (brief section 19/29: no cron infra exists in this
/// app — see AGENTS.md — so this is a lazy, dashboard/portal-load-
/// triggered scan, throttled instead of scheduled). 15 minutes balances
/// "notifications feel current" against "never recompute expensive
/// analytics on every bell click".
const THROTTLE_MS = 15 * 60 * 1000;

/// Live classes starting within this many minutes get a "starting soon"
/// reminder (brief section 4's "online class starts in 30 minutes").
const LIVE_CLASS_STARTING_SOON_WINDOW_MINUTES = 30;

/// Assignments due within this many hours get a "due soon" reminder for
/// students who haven't submitted yet.
const ASSIGNMENT_DUE_SOON_WINDOW_HOURS = 24;
/// Within this many hours of the deadline, "due soon" becomes "due today"
/// (HIGH priority) rather than just "due soon" (MEDIUM) — brief section 7:
/// don't exaggerate urgency that isn't there yet.
const ASSIGNMENT_DUE_TODAY_WINDOW_HOURS = 12;

/// The one entry point layouts call. Wins a throttle race via a single
/// conditional UPDATE (only one concurrent request's UPDATE actually
/// matches the WHERE clause and advances notificationRulesLastRunAt), then
/// runs every rule group. A rule group's own failure is caught and logged
/// rather than thrown — one broken rule (e.g. a school mid-onboarding with
/// no current term) must never prevent a user from seeing their existing
/// notifications, which is all this function is a side-effect of refreshing.
export async function maybeRunNotificationRules(schoolId: string): Promise<void> {
  const now = new Date();
  const threshold = new Date(now.getTime() - THROTTLE_MS);

  const won = await prisma.school.updateMany({
    where: { id: schoolId, OR: [{ notificationRulesLastRunAt: null }, { notificationRulesLastRunAt: { lt: threshold } }] },
    data: { notificationRulesLastRunAt: now },
  });
  if (won.count === 0) return;

  try {
    await runNotificationRules(schoolId, now);
  } catch (err) {
    console.error("notification-rules: scan failed", err);
  }
}

async function runNotificationRules(schoolId: string, now: Date): Promise<void> {
  const [school, term] = await Promise.all([
    prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { currency: true, timezone: true, attendanceConcernThreshold: true },
    }),
    getCurrentTerm(schoolId),
  ]);

  const results = await Promise.allSettled([
    runAdminActionItemRules(schoolId, now),
    runBirthdayRules(schoolId, school.timezone, now),
    runLiveClassStartingSoonRules(schoolId, now),
    term ? runTeacherRules(schoolId, term.id, now) : Promise.resolve(),
    term ? runParentRules(schoolId, term.id, school.currency, school.attendanceConcernThreshold, now) : Promise.resolve(),
    runStudentAssignmentRules(schoolId, now),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("notification-rules: rule group failed", result.reason);
  }
}

/// Admin rule: reuse the School Health Dashboard's own Action Center
/// (already-computed, already-honest, already access-gated data) rather
/// than a second analytics pass — brief section 12's "do not create fake
/// analytics" and the closing "do not build a second risk engine". Only
/// CRITICAL/HIGH/MEDIUM items become notifications (INFORMATIONAL items
/// stay on the dashboard itself — surfacing every informational item as a
/// notification would violate brief section 7's "do not exaggerate").
async function runAdminActionItemRules(schoolId: string, now: Date): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      schoolId,
      status: "ACTIVE",
      role: {
        AND: [
          { rolePermissions: { some: { permission: { key: PERMISSIONS.ACADEMICS_MANAGE } } } },
          { rolePermissions: { some: { permission: { key: PERMISSIONS.FINANCE_VIEW } } } },
        ],
      },
    },
    select: { id: true },
  });
  if (admins.length === 0) return;
  const adminIds = admins.map((a) => a.id);

  // A synthetic permission set carrying exactly the two permissions the
  // dashboard's own access gate checks (assertSchoolHealthAccess) — every
  // recipient here was already filtered to actually hold both, so this
  // is not a privilege escalation, just enough for the dashboard's
  // internal ALL-vs-teacher-scoped branching (getAccessibleClassArmIds)
  // to resolve to ALL, exactly as it would for any of these real admins.
  const perms = new Set<string>([PERMISSIONS.ACADEMICS_MANAGE, PERMISSIONS.FINANCE_VIEW]);
  const dashboard = await getSchoolHealthDashboard(schoolId, adminIds[0], perms, undefined);
  const items = dashboard.actionItems.filter((item) => item.priority !== "INFORMATIONAL").slice(0, 6);
  await notifyAdminActionItems(schoolId, adminIds, items, now);
}

/// Birthday rule: reuse the Birthdays service (brief section 23), scoped
/// to whoever holds birthdays.view — the same permission the Birthday
/// Directory page itself requires, so this never reaches a wider audience
/// than that page already does.
async function runBirthdayRules(schoolId: string, timezone: string, now: Date): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: { schoolId, status: "ACTIVE", role: { rolePermissions: { some: { permission: { key: PERMISSIONS.BIRTHDAYS_VIEW } } } } },
    select: { id: true },
  });
  if (recipients.length === 0) return;

  const people = await listBirthdays(schoolId, timezone, {}, now);
  const todayCount = people.filter((p) => p.daysUntil === 0).length;
  const tomorrowCount = people.filter((p) => p.daysUntil === 1).length;
  await notifyBirthdaysDigest(
    schoolId,
    recipients.map((r) => r.id),
    todayCount,
    tomorrowCount,
    now
  );
}

/// Live-class rule: a time-based check (not tied to any create/update
/// event), so it belongs in the rule engine rather than as a hook in
/// live-classes.ts. Deduped per class (see notifyLiveClassStartingSoon),
/// so re-running this every 15 minutes for the same still-upcoming class
/// is a no-op after the first hit.
async function runLiveClassStartingSoonRules(schoolId: string, now: Date): Promise<void> {
  const windowEnd = new Date(now.getTime() + LIVE_CLASS_STARTING_SOON_WINDOW_MINUTES * 60 * 1000);
  const upcoming = await prisma.liveClass.findMany({
    where: { schoolId, status: "SCHEDULED", scheduledStart: { gte: now, lte: windowEnd } },
    select: { id: true, scheduledStart: true },
  });
  for (const liveClass of upcoming) {
    const minutesUntilStart = Math.max(1, Math.round((liveClass.scheduledStart.getTime() - now.getTime()) / 60000));
    await notifyLiveClassStartingSoon(schoolId, liveClass.id, minutesUntilStart);
  }
}

/// Teacher rules: assignment submissions awaiting grading, and
/// classes/subjects with no scores entered yet this term — both scoped to
/// exactly the teacher's own TeacherAssignment rows, computed with flat,
/// school-wide queries (no per-teacher round trip) so the query count
/// never grows with the number of teachers.
async function runTeacherRules(schoolId: string, termId: string, now: Date): Promise<void> {
  const [pendingSubmissions, teacherAssignments, scoredCombos] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { status: "SUBMITTED", assignment: { schoolId } },
      select: { assignment: { select: { teacherId: true } } },
    }),
    prisma.teacherAssignment.findMany({ where: { schoolId }, select: { teacherId: true, subjectId: true, classArmId: true } }),
    prisma.score.groupBy({ by: ["subjectId", "classArmId"], where: { schoolId, termId } }),
  ]);

  const gradingPendingByTeacher = new Map<string, number>();
  for (const submission of pendingSubmissions) {
    const teacherId = submission.assignment.teacherId;
    gradingPendingByTeacher.set(teacherId, (gradingPendingByTeacher.get(teacherId) ?? 0) + 1);
  }

  const scoredComboKeys = new Set(scoredCombos.map((c) => `${c.subjectId}:${c.classArmId}`));
  const missingByTeacher = new Map<string, number>();
  for (const assignment of teacherAssignments) {
    if (!scoredComboKeys.has(`${assignment.subjectId}:${assignment.classArmId}`)) {
      missingByTeacher.set(assignment.teacherId, (missingByTeacher.get(assignment.teacherId) ?? 0) + 1);
    }
  }

  const teacherIds = new Set([...gradingPendingByTeacher.keys(), ...missingByTeacher.keys()]);
  await Promise.all(
    [...teacherIds].flatMap((teacherId) => [
      notifyAssignmentGradingPending(schoolId, teacherId, gradingPendingByTeacher.get(teacherId) ?? 0, now),
      notifyTeacherScoresPending(schoolId, teacherId, termId, missingByTeacher.get(teacherId) ?? 0, now),
    ])
  );
}

/// Parent rules: outstanding fees and attendance concern, each computed
/// school-wide with flat queries and then fanned out only to the specific
/// guardian(s) of the specific student(s) actually affected — brief
/// section 27's "a parent must NEVER see total school outstanding fees,
/// only their own child's" is enforced here by construction: every
/// notification this function sends carries exactly one studentId and
/// goes only to that student's own linked guardians.
async function runParentRules(schoolId: string, termId: string, currency: string, attendanceConcernThreshold: number, now: Date): Promise<void> {
  await Promise.all([
    runParentFeesRule(schoolId, currency, now),
    runParentAttendanceRule(schoolId, termId, attendanceConcernThreshold, now),
  ]);
}

async function runParentFeesRule(schoolId: string, currency: string, now: Date): Promise<void> {
  const invoices = await prisma.invoice.findMany({
    where: { schoolId, status: { not: "CANCELLED" } },
    select: {
      studentId: true,
      totalMinor: true,
      payments: { where: { status: "CONFIRMED" }, select: { amountMinor: true } },
    },
  });

  const outstandingByStudent = new Map<string, number>();
  for (const invoice of invoices) {
    const paid = invoice.payments.reduce((sum, p) => sum + p.amountMinor, 0);
    const outstanding = invoice.totalMinor - paid;
    if (outstanding > 0) outstandingByStudent.set(invoice.studentId, (outstandingByStudent.get(invoice.studentId) ?? 0) + outstanding);
  }
  if (outstandingByStudent.size === 0) return;

  const students = await prisma.student.findMany({
    where: { schoolId, id: { in: [...outstandingByStudent.keys()] }, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, guardians: { include: { guardian: true } } },
  });

  await Promise.all(
    students.flatMap((student) => {
      const outstanding = outstandingByStudent.get(student.id) ?? 0;
      const studentName = `${student.firstName} ${student.lastName}`;
      return student.guardians
        .filter((sg) => sg.guardian.userId)
        .map((sg) => notifyParentFeesOutstanding(schoolId, sg.guardian.userId!, student.id, studentName, outstanding, currency, now));
    })
  );
}

/// Attendance rate here is PRESENT / (PRESENT + ABSENT + LATE), excluding
/// EXCUSED from the denominator — a simple, direct aggregate (not the
/// School Health / Performance Analysis engines' own definitions, which
/// this deliberately doesn't reinvent or import, to avoid coupling this
/// rule to their internals). Students with fewer than
/// MIN_RECORDS_FOR_SIGNAL records are skipped so one or two early-term
/// absences never trigger a concern before there's enough data to mean
/// anything (brief section 7: "do not exaggerate").
const MIN_ATTENDANCE_RECORDS_FOR_SIGNAL = 5;

async function runParentAttendanceRule(schoolId: string, termId: string, attendanceConcernThreshold: number, now: Date): Promise<void> {
  const counts = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: { schoolId, termId },
    _count: { _all: true },
  });

  const byStudent = new Map<string, { present: number; absent: number; late: number }>();
  for (const row of counts) {
    const entry = byStudent.get(row.studentId) ?? { present: 0, absent: 0, late: 0 };
    if (row.status === "PRESENT") entry.present += row._count._all;
    else if (row.status === "ABSENT") entry.absent += row._count._all;
    else if (row.status === "LATE") entry.late += row._count._all;
    byStudent.set(row.studentId, entry);
  }

  const concerning: { studentId: string; rate: number }[] = [];
  for (const [studentId, entry] of byStudent) {
    const total = entry.present + entry.absent + entry.late;
    if (total < MIN_ATTENDANCE_RECORDS_FOR_SIGNAL) continue;
    const rate = Math.round((entry.present / total) * 1000) / 10;
    if (rate < attendanceConcernThreshold) concerning.push({ studentId, rate });
  }
  if (concerning.length === 0) return;

  const students = await prisma.student.findMany({
    where: { schoolId, id: { in: concerning.map((c) => c.studentId) }, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, guardians: { include: { guardian: true } } },
  });
  const rateByStudent = new Map(concerning.map((c) => [c.studentId, c.rate]));

  await Promise.all(
    students.flatMap((student) => {
      const rate = rateByStudent.get(student.id)!;
      const studentName = `${student.firstName} ${student.lastName}`;
      return student.guardians
        .filter((sg) => sg.guardian.userId)
        .map((sg) => notifyParentAttendanceConcern(schoolId, sg.guardian.userId!, student.id, studentName, rate, termId, now));
    })
  );
}

/// Student rule: assignments due within the next 24 hours that this
/// student hasn't submitted yet — scoped to exactly their own pending
/// submissions, computed with one flat query across every assignment
/// due soon (not per-student).
async function runStudentAssignmentRules(schoolId: string, now: Date): Promise<void> {
  const windowEnd = new Date(now.getTime() + ASSIGNMENT_DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000);
  const dueSoonTodayCutoff = new Date(now.getTime() + ASSIGNMENT_DUE_TODAY_WINDOW_HOURS * 60 * 60 * 1000);

  const assignments = await prisma.assignment.findMany({
    where: { schoolId, dueDate: { gte: now, lte: windowEnd } },
    select: {
      dueDate: true,
      submissions: { where: { status: "PENDING" }, select: { studentId: true } },
    },
  });
  if (assignments.length === 0) return;

  const countByStudent = new Map<string, number>();
  const dueTodayStudents = new Set<string>();
  for (const assignment of assignments) {
    const isDueToday = assignment.dueDate <= dueSoonTodayCutoff;
    for (const submission of assignment.submissions) {
      countByStudent.set(submission.studentId, (countByStudent.get(submission.studentId) ?? 0) + 1);
      if (isDueToday) dueTodayStudents.add(submission.studentId);
    }
  }
  if (countByStudent.size === 0) return;

  const students = await prisma.student.findMany({
    where: { schoolId, id: { in: [...countByStudent.keys()] }, status: "ACTIVE", userId: { not: null } },
    select: { id: true, userId: true },
  });

  await Promise.all(
    students.map((student) =>
      notifyStudentAssignmentDueSoon(schoolId, student.userId!, countByStudent.get(student.id) ?? 0, dueTodayStudents.has(student.id), now)
    )
  );
}
