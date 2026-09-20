import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

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

/// For the Academics page's class-management card — each arm's own
/// student count, shown up front so an admin can see at a glance which
/// arms are safe to delete without needing to try first.
export async function listClassGroupsWithArms(schoolId: string) {
  return prisma.classGroup.findMany({
    where: { schoolId },
    orderBy: { order: "asc" },
    include: {
      arms: {
        orderBy: { name: "asc" },
        include: { _count: { select: { students: true } } },
      },
    },
  });
}

/// Adds one class to the school's list — creates the ClassGroup plus a
/// default "A" arm, the same shape setupAcademicStructure produces during
/// onboarding, so a class added later behaves identically to one added at
/// setup. New classes sort after every existing one.
export async function createClassGroup(schoolId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Class name is required.");

  const existing = await prisma.classGroup.findFirst({ where: { schoolId, name: { equals: trimmed, mode: "insensitive" } } });
  if (existing) throw new Error(`A class named "${trimmed}" already exists.`);

  const highest = await prisma.classGroup.aggregate({ where: { schoolId }, _max: { order: true } });
  const order = (highest._max.order ?? -1) + 1;

  return prisma.$transaction(async (tx) => {
    const classGroup = await tx.classGroup.create({ data: { schoolId, name: trimmed, order } });
    await tx.classArm.create({ data: { schoolId, classGroupId: classGroup.id, name: "A" } });
    return classGroup;
  });
}

/// A second (or third, ...) stream within an existing class, e.g. "B" next
/// to Primary 4's existing "A" — every other class-scoped feature (results,
/// attendance, timetable) already treats each arm as its own roster.
export async function createClassArm(schoolId: string, classGroupId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Arm name is required.");

  const classGroup = await prisma.classGroup.findFirst({ where: { id: classGroupId, schoolId } });
  if (!classGroup) throw new Error("Class not found.");

  const existing = await prisma.classArm.findFirst({ where: { classGroupId, name: { equals: trimmed, mode: "insensitive" } } });
  if (existing) throw new Error(`Arm "${trimmed}" already exists for ${classGroup.name}.`);

  return prisma.classArm.create({ data: { schoolId, classGroupId, name: trimmed } });
}

/// Refuses to delete an arm with students still in it — the safety check
/// that matters, since a cascade there would silently wipe roster history.
/// Anything else genuinely tied to the arm (timetable slots, results, a
/// teacher assignment) either cascades cleanly or, for the handful of
/// relations that intentionally restrict deletion, surfaces as a friendly
/// message instead of a raw foreign-key error.
export async function deleteClassArm(schoolId: string, classArmId: string) {
  const classArm = await prisma.classArm.findFirst({ where: { id: classArmId, schoolId }, include: { classGroup: true } });
  if (!classArm) throw new Error("Class not found.");

  const studentCount = await prisma.student.count({ where: { classArmId } });
  if (studentCount > 0) {
    throw new Error(`${classArm.classGroup.name} ${classArm.name} still has ${studentCount} student${studentCount === 1 ? "" : "s"} — move or remove them first.`);
  }

  try {
    await prisma.classArm.delete({ where: { id: classArmId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new Error(`${classArm.classGroup.name} ${classArm.name} still has related records (e.g. results or a CBT exam) and can't be deleted yet.`);
    }
    throw error;
  }
}

/// Only deletable once every arm under it is gone — same "empty it out
/// first" rule as deleteClassArm, one level up.
export async function deleteClassGroup(schoolId: string, classGroupId: string) {
  const classGroup = await prisma.classGroup.findFirst({ where: { id: classGroupId, schoolId } });
  if (!classGroup) throw new Error("Class not found.");

  const armCount = await prisma.classArm.count({ where: { classGroupId } });
  if (armCount > 0) throw new Error(`${classGroup.name} still has ${armCount} arm${armCount === 1 ? "" : "s"} — delete ${armCount === 1 ? "it" : "them"} first.`);

  await prisma.classGroup.delete({ where: { id: classGroupId } });
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

/// Reachable by anyone holding ACADEMICS_MANAGE (school admin/owner/
/// principal) or the narrower SUBJECTS_CREATE (teachers, by default) — see
/// requireAnyPermission in src/lib/auth/require.ts. Deliberately just a
/// name+code insert with a friendly duplicate check; unlike
/// setupAcademicStructure this never touches sessions/terms/classes, so a
/// teacher granted only SUBJECTS_CREATE can never restructure the school's
/// academic calendar or class list, only add to the subject catalog.
export async function createSubject(schoolId: string, input: { name: string; code: string }) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name) throw new Error("Subject name is required.");
  if (!code) throw new Error("Subject code is required.");

  const existing = await prisma.subject.findFirst({
    where: { schoolId, OR: [{ code }, { name: { equals: name, mode: "insensitive" } }] },
  });
  if (existing) {
    throw new Error(
      existing.code === code
        ? `A subject with code "${code}" already exists.`
        : `A subject named "${name}" already exists.`
    );
  }

  return prisma.subject.create({ data: { schoolId, name, code } });
}

/// Same authorization as createSubject — fixes a typo in an existing
/// subject's name/code without needing to delete and recreate it (which
/// would orphan any lectures/assignments/results already tied to the old
/// subject id).
export async function updateSubject(schoolId: string, subjectId: string, input: { name: string; code: string }) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name) throw new Error("Subject name is required.");
  if (!code) throw new Error("Subject code is required.");

  const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
  if (!subject) throw new Error("Subject not found.");

  const existing = await prisma.subject.findFirst({
    where: { schoolId, id: { not: subjectId }, OR: [{ code }, { name: { equals: name, mode: "insensitive" } }] },
  });
  if (existing) {
    throw new Error(
      existing.code === code
        ? `A subject with code "${code}" already exists.`
        : `A subject named "${name}" already exists.`
    );
  }

  return prisma.subject.update({ where: { id: subjectId }, data: { name, code } });
}
