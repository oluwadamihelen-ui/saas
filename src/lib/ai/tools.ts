import "server-only";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { getDashboardStats } from "@/lib/services/dashboard";
import { getFinanceStats } from "@/lib/services/finance-dashboard";
import { listStudents, getStudent } from "@/lib/services/students";
import { getStudentAttendanceHistory, getTodayAttendanceSummary, markAttendance } from "@/lib/services/attendance";
import { computeReportCard } from "@/lib/services/results";
import { computePreschoolReport, listAssessmentLevels } from "@/lib/services/preschool-results";
import { getCurrentTerm } from "@/lib/services/academics";
import { listInvoicesForStudent, invoiceBalanceMinor } from "@/lib/services/invoices";
import type { AiToolDefinition } from "@/lib/ai/types";
import type { AttendanceStatus } from "@/generated/prisma/client";

export interface AiTool {
  definition: AiToolDefinition;
  permission: PermissionKey;
  /// Read tools run as soon as the model asks for them. Write tools stop
  /// at PROPOSED (see AiToolCallStatus in schema.prisma) — the assistant
  /// service never calls execute() for one until the signed-in user
  /// explicitly confirms it, same human-in-the-loop principle the report
  /// card approve/publish workflow already uses.
  kind: "read" | "write";
  execute(schoolId: string, actingUserId: string, args: Record<string, unknown>): Promise<unknown>;
}

async function requireStudent(schoolId: string, studentId: unknown) {
  if (typeof studentId !== "string" || !studentId) throw new Error("studentId is required.");
  const student = await getStudent(schoolId, studentId);
  if (!student) throw new Error("No student found with that id.");
  return student;
}

export const AI_TOOLS: AiTool[] = [
  {
    definition: {
      name: "get_dashboard_summary",
      description: "Get the school's headline numbers: student/staff counts, class arms, and the current academic session/term.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    permission: PERMISSIONS.DASHBOARD_VIEW,
    kind: "read",
    async execute(schoolId) {
      const stats = await getDashboardStats(schoolId);
      return {
        totalStudents: stats.totalStudents,
        activeStudents: stats.activeStudents,
        totalStaff: stats.totalStaff,
        totalClassArms: stats.totalClassArms,
        currentSession: stats.currentSession?.name ?? null,
        currentTerm: stats.currentTerm?.name ?? null,
      };
    },
  },
  {
    definition: {
      name: "find_student",
      description: "Search for students by name or admission number. Returns up to 5 matches with their id, so other tools can look up a specific student.",
      parameters: {
        type: "object",
        properties: { search: { type: "string", description: "Name or admission number to search for" } },
        required: ["search"],
      },
    },
    permission: PERMISSIONS.STUDENTS_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const search = typeof args.search === "string" ? args.search : "";
      const { students, total } = await listStudents(schoolId, { search, page: 1 });
      return {
        totalMatches: total,
        students: students.slice(0, 5).map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          admissionNumber: s.admissionNumber,
          class: s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "Unassigned",
          status: s.status,
        })),
      };
    },
  },
  {
    definition: {
      name: "get_student_profile",
      description: "Get a specific student's profile (class, status, guardians) by their id, as returned by find_student.",
      parameters: {
        type: "object",
        properties: { studentId: { type: "string" } },
        required: ["studentId"],
      },
    },
    permission: PERMISSIONS.STUDENTS_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const student = await requireStudent(schoolId, args.studentId);
      return {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        class: student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "Unassigned",
        status: student.status,
        guardians: student.guardians.map((sg) => ({
          name: `${sg.guardian.firstName} ${sg.guardian.lastName}`,
          relationship: sg.relationship,
          phone: sg.guardian.phone,
        })),
      };
    },
  },
  {
    definition: {
      name: "get_todays_attendance_summary",
      description: "Get today's school-wide attendance: how many active students, how many marked, present, absent, and the attendance rate.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    permission: PERMISSIONS.ATTENDANCE_VIEW,
    kind: "read",
    async execute(schoolId) {
      return getTodayAttendanceSummary(schoolId);
    },
  },
  {
    definition: {
      name: "get_student_attendance",
      description: "Get a specific student's recent attendance history and attendance rate.",
      parameters: {
        type: "object",
        properties: { studentId: { type: "string" } },
        required: ["studentId"],
      },
    },
    permission: PERMISSIONS.ATTENDANCE_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const student = await requireStudent(schoolId, args.studentId);
      const history = await getStudentAttendanceHistory(schoolId, student.id, 10);
      return {
        student: `${student.firstName} ${student.lastName}`,
        attendanceRate: history.attendanceRate,
        totalRecorded: history.total,
        recent: history.records.map((r) => ({ date: r.date.toISOString().slice(0, 10), status: r.status })),
      };
    },
  },
  {
    definition: {
      name: "get_student_results",
      description: "Get a specific student's subject scores and grades for the current term (or a given term id).",
      parameters: {
        type: "object",
        properties: {
          studentId: { type: "string" },
          termId: { type: "string", description: "Optional; defaults to the current term" },
        },
        required: ["studentId"],
      },
    },
    permission: PERMISSIONS.RESULTS_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const student = await requireStudent(schoolId, args.studentId);
      const termId = typeof args.termId === "string" && args.termId ? args.termId : (await getCurrentTerm(schoolId))?.id;
      if (!termId) return { student: `${student.firstName} ${student.lastName}`, message: "No active term configured." };

      const report = await computeReportCard(schoolId, student.id, termId);
      return {
        student: `${student.firstName} ${student.lastName}`,
        term: report.term?.name ?? null,
        overallAverage: report.overallAverage,
        position: report.position,
        classSize: report.classSize,
        subjects: report.subjectRows.map((r) => ({ subject: r.subjectName, total: r.total, maxTotal: r.maxTotal, grade: r.grade })),
      };
    },
  },
  {
    definition: {
      name: "get_student_milestone_results",
      description:
        "Get a specific pre-school/nursery student's developmental milestone assessments for the current term (or a given term id) — which learning outcomes they've achieved, are progressing on, or need support with, by subject and topic. Use this instead of get_student_results for a class using milestone-based assessment (not numerical scores).",
      parameters: {
        type: "object",
        properties: {
          studentId: { type: "string" },
          termId: { type: "string", description: "Optional; defaults to the current term" },
        },
        required: ["studentId"],
      },
    },
    permission: PERMISSIONS.RESULTS_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const student = await requireStudent(schoolId, args.studentId);
      const termId = typeof args.termId === "string" && args.termId ? args.termId : (await getCurrentTerm(schoolId))?.id;
      if (!termId) return { student: `${student.firstName} ${student.lastName}`, message: "No active term configured." };

      const [report, levels] = await Promise.all([computePreschoolReport(schoolId, student.id, termId), listAssessmentLevels(schoolId)]);
      const labelByLevel = new Map(levels.map((l) => [l.level, l.label]));

      return {
        student: `${student.firstName} ${student.lastName}`,
        term: report.term?.name ?? null,
        totalMilestonesAssessed: report.totalMilestonesAssessed,
        subjects: report.subjects.map((s) => ({
          subject: s.subjectName,
          milestones: s.topics.flatMap((t) =>
            t.milestones.map((m) => ({ topic: t.topicTitle, milestone: m.title, level: labelByLevel.get(m.level) ?? m.level, comment: m.comment }))
          ),
        })),
      };
    },
  },
  {
    definition: {
      name: "get_student_fees",
      description: "Get a specific student's invoices and outstanding balance.",
      parameters: {
        type: "object",
        properties: { studentId: { type: "string" } },
        required: ["studentId"],
      },
    },
    permission: PERMISSIONS.FINANCE_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const student = await requireStudent(schoolId, args.studentId);
      const [invoices, school] = await Promise.all([
        listInvoicesForStudent(schoolId, student.id),
        prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
      ]);
      return {
        student: `${student.firstName} ${student.lastName}`,
        invoices: invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          term: inv.term.name,
          status: inv.status,
          totalDue: formatMoney(invoiceBalanceMinor(inv), school.currency),
        })),
      };
    },
  },
  {
    definition: {
      name: "get_finance_summary",
      description: "Get the school's finance summary for the current term: revenue collected, outstanding balance, and overdue invoice count.",
      parameters: {
        type: "object",
        properties: { termId: { type: "string", description: "Optional; defaults to the current term" } },
        required: [],
      },
    },
    permission: PERMISSIONS.FINANCE_VIEW,
    kind: "read",
    async execute(schoolId, _userId, args) {
      const termId = typeof args.termId === "string" && args.termId ? args.termId : (await getCurrentTerm(schoolId))?.id;
      const [stats, school] = await Promise.all([
        getFinanceStats(schoolId, termId),
        prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
      ]);
      return {
        revenueCollected: formatMoney(stats.revenueMinor, school.currency),
        outstanding: formatMoney(stats.outstandingMinor, school.currency),
        overdueInvoices: stats.overdueCount,
        totalInvoices: stats.totalInvoices,
      };
    },
  },
  {
    definition: {
      name: "mark_student_attendance",
      description:
        "Mark ONE student's attendance for a given date (defaults to today). This is a write action — it will be shown to the user for confirmation before it runs.",
      parameters: {
        type: "object",
        properties: {
          studentId: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
          status: { type: "string", enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"] },
        },
        required: ["studentId", "status"],
      },
    },
    permission: PERMISSIONS.ATTENDANCE_MARK,
    kind: "write",
    async execute(schoolId, actingUserId, args) {
      const student = await requireStudent(schoolId, args.studentId);
      if (!student.classArmId) throw new Error(`${student.firstName} ${student.lastName} isn't assigned to a class.`);

      const status = args.status as AttendanceStatus;
      const date = typeof args.date === "string" && args.date ? args.date : new Date().toISOString().slice(0, 10);

      await markAttendance(schoolId, actingUserId, {
        classArmId: student.classArmId,
        date,
        entries: [{ studentId: student.id, status }],
      });

      return { student: `${student.firstName} ${student.lastName}`, date, status };
    },
  },
];

export function getToolsForPermissions(perms: Set<string>): AiTool[] {
  return AI_TOOLS.filter((t) => perms.has(t.permission));
}

export function getToolByName(name: string): AiTool | undefined {
  return AI_TOOLS.find((t) => t.definition.name === name);
}
