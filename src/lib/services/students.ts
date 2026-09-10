import "server-only";
import { prisma } from "@/lib/db";
import { requireStudentCapacity } from "@/lib/billing/entitlements";
import type { Gender, GuardianRelationship, Prisma, StudentStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

type Tx = Prisma.TransactionClient;

/// The single write path for StudentClassHistory from a live (not
/// imported) class assignment — called only from createStudent and
/// updateStudent, so "a student's class was deliberately set/changed" has
/// exactly one place that logs it, per the audit's "ensure history is not
/// duplicated" requirement. Not called on every student save: only when
/// classArmId is actually being set to a new value.
///
/// Resolves the school's current academic session and:
/// - closes whichever of this student's history rows is still open
///   (endDate null), if its class differs from the new one — an arm
///   change (or a promotion) is "the old segment just ended," not an
///   edit to it;
/// - does nothing if the open row already matches (e.g. an unrelated
///   profile edit that happens to re-submit the same classArmId);
/// - creates a new open row for the new class.
/// Skips silently if the school has no current session yet (early
/// onboarding, before Academics is set up) — there's no session to file
/// the row under, and this must never block saving the student.
async function recordClassHistory(tx: Tx, schoolId: string, studentId: string, classArmId: string) {
  const currentSession = await tx.academicSession.findFirst({ where: { schoolId, isCurrent: true } });
  if (!currentSession) return;

  const openRow = await tx.studentClassHistory.findFirst({
    where: { schoolId, studentId, endDate: null },
    orderBy: { startDate: "desc" },
  });
  if (openRow?.classArmId === classArmId) return;

  const now = new Date();
  if (openRow) {
    await tx.studentClassHistory.update({ where: { id: openRow.id }, data: { endDate: now } });
  }
  await tx.studentClassHistory.create({
    data: {
      schoolId,
      studentId,
      academicSessionId: currentSession.id,
      classArmId,
      startDate: now,
      status: "ACTIVE",
      source: "ENTERED",
    },
  });
}

export interface StudentListFilters {
  search?: string;
  classArmId?: string;
  status?: StudentStatus;
  page?: number;
}

/// Every function here takes schoolId as the first argument and folds it
/// into the where clause — there is no path to a bare, unscoped query for
/// this model, so a missed tenant filter is a compile error, not a leak.
export async function listStudents(schoolId: string, filters: StudentListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.StudentWhereInput = {
    schoolId,
    ...(filters.classArmId ? { classArmId: filters.classArmId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { admissionNumber: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { classArm: { include: { classGroup: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total, page, pageSize: PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/// Unpaginated, active students only — for assignment pickers (library
/// loans, transport, hostel) rather than the main directory table.
export async function listActiveStudentsBrief(schoolId: string) {
  return prisma.student.findMany({
    where: { schoolId, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getStudent(schoolId: string, id: string) {
  return prisma.student.findFirst({
    where: { schoolId, id },
    include: {
      classArm: { include: { classGroup: true } },
      campus: true,
      guardians: { include: { guardian: true } },
    },
  });
}

async function generateAdmissionNumber(schoolId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { schoolId } });
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

export interface StudentInput {
  /// Only meaningful for a bulk import migrating a school's existing
  /// records (see student-import.ts) — direct enrollment and admission
  /// always leave this unset so createStudent generates one, since a
  /// human-entered admission number risks colliding with the counter's
  /// next value.
  admissionNumber?: string;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  photoUrl?: string | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  medicalNotes?: string | null;
  allergies?: string | null;
  emergencyContact?: string | null;
  classArmId?: string | null;
  campusId?: string | null;
  guardian?: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    relationship: GuardianRelationship;
  } | null;
}

/// Every path that creates a student — direct enrollment and admission's
/// admitApplicant — funnels through here, so requireStudentCapacity() only
/// needs to be called in this one place to cover both (spec section 10).
export async function createStudent(schoolId: string, input: StudentInput) {
  await requireStudentCapacity(schoolId);
  const admissionNumber = input.admissionNumber?.trim() || (await generateAdmissionNumber(schoolId));

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        schoolId,
        admissionNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        otherNames: input.otherNames || null,
        photoUrl: input.photoUrl || null,
        dateOfBirth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        bloodGroup: input.bloodGroup || null,
        nationality: input.nationality || "Nigeria",
        addressLine: input.addressLine || null,
        city: input.city || null,
        state: input.state || null,
        medicalNotes: input.medicalNotes || null,
        allergies: input.allergies || null,
        emergencyContact: input.emergencyContact || null,
        classArmId: input.classArmId || null,
        campusId: input.campusId || null,
      },
    });

    if (input.guardian) {
      const guardian = await tx.guardian.create({
        data: {
          schoolId,
          firstName: input.guardian.firstName,
          lastName: input.guardian.lastName,
          phone: input.guardian.phone,
          email: input.guardian.email || null,
        },
      });
      await tx.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: input.guardian.relationship,
          isPrimary: true,
        },
      });
    }

    if (input.classArmId) {
      await recordClassHistory(tx, schoolId, student.id, input.classArmId);
    }

    return student;
  });
}

export async function updateStudent(schoolId: string, id: string, input: Partial<StudentInput>) {
  const existing = await prisma.student.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Student not found");

  /// A class change is anything from a routine profile edit that also
  /// touches classArmId to a deliberate promotion/transfer — either way,
  /// Student.classArmId (the current-class source of truth every other
  /// feature already reads) is unaffected in how it behaves; this only
  /// decides whether a StudentClassHistory row also gets written.
  const isClassChange = "classArmId" in input && input.classArmId !== existing.classArmId;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        otherNames: input.otherNames,
        photoUrl: input.photoUrl,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        bloodGroup: input.bloodGroup,
        nationality: input.nationality,
        addressLine: input.addressLine,
        city: input.city,
        state: input.state,
        medicalNotes: input.medicalNotes,
        allergies: input.allergies,
        emergencyContact: input.emergencyContact,
        classArmId: input.classArmId,
        campusId: input.campusId,
      },
    });

    if (isClassChange && input.classArmId) {
      await recordClassHistory(tx, schoolId, id, input.classArmId);
    } else if (isClassChange && input.classArmId === null) {
      // Explicitly unassigned from any class — close the open history
      // segment (the student has no current class), but there's no new
      // class to log a row for.
      const openRow = await tx.studentClassHistory.findFirst({ where: { schoolId, studentId: id, endDate: null } });
      if (openRow) await tx.studentClassHistory.update({ where: { id: openRow.id }, data: { endDate: new Date() } });
    }

    return student;
  });
}

export async function withdrawStudent(schoolId: string, id: string) {
  const existing = await prisma.student.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Student not found");

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.update({ where: { id }, data: { status: "WITHDRAWN" } });

    const openRow = await tx.studentClassHistory.findFirst({ where: { schoolId, studentId: id, endDate: null } });
    if (openRow) {
      await tx.studentClassHistory.update({ where: { id: openRow.id }, data: { endDate: new Date(), status: "WITHDRAWN" } });
    }

    return student;
  });
}

export async function addGuardianToStudent(
  schoolId: string,
  studentId: string,
  input: { firstName: string; lastName: string; phone: string; email?: string | null; relationship: GuardianRelationship }
) {
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });
  if (!student) throw new Error("Student not found");

  const guardian = await prisma.guardian.create({
    data: {
      schoolId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email || null,
    },
  });

  return prisma.studentGuardian.create({
    data: { studentId, guardianId: guardian.id, relationship: input.relationship, isPrimary: false },
  });
}
