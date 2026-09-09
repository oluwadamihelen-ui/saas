import "server-only";
import { prisma } from "@/lib/db";

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/// Onboarding step 3 ("academic structure"). Creates one academic session
/// split into three evenly-spaced terms, a class group + one default arm
/// per class name given, and a subject per subject name given. Arms and
/// per-class subject assignment can be refined later from the dashboard —
/// this just gets a school to a state where students can be enrolled.
export async function setupAcademicStructure(
  schoolId: string,
  input: {
    sessionName: string;
    startDate: Date;
    endDate: Date;
    classNames: string;
    subjectNames: string;
  }
) {
  const totalDays = Math.max(
    3,
    Math.round((input.endDate.getTime() - input.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const termLength = Math.floor(totalDays / 3);

  const termSpans = [
    { name: "First Term", start: input.startDate, end: addDays(input.startDate, termLength) },
    {
      name: "Second Term",
      start: addDays(input.startDate, termLength + 1),
      end: addDays(input.startDate, termLength * 2),
    },
    {
      name: "Third Term",
      start: addDays(input.startDate, termLength * 2 + 1),
      end: input.endDate,
    },
  ];

  const classNames = splitList(input.classNames);
  const subjectNames = splitList(input.subjectNames);

  return prisma.$transaction(async (tx) => {
    const session = await tx.academicSession.create({
      data: {
        schoolId,
        name: input.sessionName,
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: true,
      },
    });

    await tx.term.createMany({
      data: termSpans.map((t, i) => ({
        schoolId,
        academicSessionId: session.id,
        name: t.name,
        startDate: t.start,
        endDate: t.end,
        isCurrent: i === 0,
      })),
    });

    for (const [index, name] of classNames.entries()) {
      const classGroup = await tx.classGroup.create({
        data: { schoolId, name, order: index },
      });
      await tx.classArm.create({ data: { schoolId, classGroupId: classGroup.id, name: "A" } });
    }

    if (subjectNames.length > 0) {
      await tx.subject.createMany({
        data: subjectNames.map((name, i) => ({
          schoolId,
          name,
          code: `SUB${String(i + 1).padStart(3, "0")}`,
        })),
      });
    }

    await tx.school.update({
      where: { id: schoolId },
      data: { academicStructureSetupAt: new Date() },
    });

    return session;
  });
}

export async function listClassArms(schoolId: string) {
  return prisma.classArm.findMany({
    where: { schoolId },
    include: { classGroup: true },
    orderBy: [{ classGroup: { order: "asc" } }, { name: "asc" }],
  });
}

export async function listClassGroups(schoolId: string) {
  return prisma.classGroup.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
}

export async function listTerms(schoolId: string) {
  return prisma.term.findMany({ where: { schoolId }, include: { academicSession: true }, orderBy: { startDate: "desc" } });
}

export async function getCurrentSession(schoolId: string) {
  return prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } });
}

export async function getCurrentTerm(schoolId: string) {
  return prisma.term.findFirst({ where: { schoolId, isCurrent: true } });
}

export async function listSubjects(schoolId: string) {
  return prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}
