import "server-only";
import { prisma } from "@/lib/db";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { notifyAttendanceAbsent } from "@/lib/services/notifications";

function normalizeDate(date: string | Date): Date {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00.000Z`) : date;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getRosterForDate(schoolId: string, classArmId: string, date: string) {
  const classArm = await prisma.classArm.findFirst({ where: { id: classArmId, schoolId } });
  if (!classArm) throw new Error("Class not found");

  const day = normalizeDate(date);
  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, classArmId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.attendanceRecord.findMany({ where: { schoolId, classArmId, date: day } }),
  ]);
  const recordByStudent = new Map(records.map((r) => [r.studentId, r]));

  return {
    classArm,
    students: students.map((s) => ({ student: s, record: recordByStudent.get(s.id) ?? null })),
  };
}

export async function markAttendance(
  schoolId: string,
  markedById: string,
  input: { classArmId: string; date: string; entries: { studentId: string; status: AttendanceStatus }[] }
) {
  const term = await prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
  if (!term) throw new Error("No active term is configured for this school.");

  const day = normalizeDate(input.date);

  await prisma.$transaction(
    input.entries.map((entry) =>
      prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: entry.studentId, date: day } },
        create: {
          schoolId,
          studentId: entry.studentId,
          classArmId: input.classArmId,
          termId: term.id,
          date: day,
          status: entry.status,
          markedById,
        },
        update: { status: entry.status, markedById, classArmId: input.classArmId },
      })
    )
  );

  await Promise.all(
    input.entries
      .filter((entry) => entry.status === "ABSENT")
      .map((entry) => notifyAttendanceAbsent(schoolId, entry.studentId, day))
  );
}

export async function getStudentAttendanceHistory(schoolId: string, studentId: string, take = 30) {
  const records = await prisma.attendanceRecord.findMany({
    where: { schoolId, studentId },
    orderBy: { date: "desc" },
    take,
  });
  const total = await prisma.attendanceRecord.count({ where: { schoolId, studentId } });
  const presentCount = await prisma.attendanceRecord.count({
    where: { schoolId, studentId, status: { in: ["PRESENT", "LATE"] } },
  });
  return {
    records,
    total,
    attendanceRate: total > 0 ? Math.round((presentCount / total) * 100) : null,
  };
}

export async function getTodayAttendanceSummary(schoolId: string) {
  const today = normalizeDate(new Date());
  const [totalActiveStudents, todayRecords] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.attendanceRecord.findMany({ where: { schoolId, date: today } }),
  ]);

  const present = todayRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const absent = todayRecords.filter((r) => r.status === "ABSENT").length;
  const marked = todayRecords.length;

  return {
    totalActiveStudents,
    marked,
    present,
    absent,
    attendanceRate: marked > 0 ? Math.round((present / marked) * 100) : null,
  };
}
