import "server-only";
import { prisma } from "@/lib/db";
import { requireStudentCapacity } from "@/lib/billing/entitlements";
import { Prisma } from "@/generated/prisma/client";
import type { Gender, GuardianRelationship, StudentStatus } from "@/generated/prisma/client";

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

/// Prefixes with the school's configured admissionNumberPrefix when set
/// (e.g. "WMS" → "WMS-2026-0192"); unset schools keep the original bare
/// "YYYY-NNNN" format unchanged. The sequence itself is a running
/// count-of-all-students-so-far — not reset per year or session — which
/// predates this prefix feature and is left as-is.
///
/// Takes the transaction client, not the bare prisma client: the count
/// read and the student insert must happen inside the SAME Serializable
/// transaction (see createStudent) for Postgres to actually detect two
/// concurrent requests computing the same "next" number — reading the
/// count outside the transaction (as an earlier version of this function
/// did) can't be protected by isolation level at all, since the read and
/// write are then in two unrelated transactions.
async function generateAdmissionNumber(tx: Tx, schoolId: string) {
  const [school, count] = await Promise.all([
    tx.school.findUnique({ where: { id: schoolId }, select: { admissionNumberPrefix: true } }),
    tx.student.count({ where: { schoolId } }),
  ]);
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, "0");
  return school?.admissionNumberPrefix ? `${school.admissionNumberPrefix}-${year}-${sequence}` : `${year}-${sequence}`;
}

// Only an auto-generated number is safe to silently retry on collision — a
// caller-supplied one (CSV import's admissionNumber column) colliding is a
// real duplicate the caller must see and fix, not something to paper over.
const MAX_ADMISSION_NUMBER_ATTEMPTS = 8;

// P2002: the @@unique([schoolId, admissionNumber]) backstop was hit anyway
// (e.g. racing against a row inserted just before this transaction began).
// P2034: Postgres aborted this transaction under Serializable isolation
// because it overlapped with a concurrent one — Prisma's documented
// pattern for this exact "two transactions computed the same counter
// value" race is to catch P2034 and simply retry.
function isRetryableAdmissionNumberError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  return error.code === "P2002" && Array.isArray(error.meta?.target) && (error.meta.target as string[]).includes("admissionNumber");
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
  const explicitAdmissionNumber = input.admissionNumber?.trim() || undefined;

  // A caller-supplied number (CSV import) gets exactly one attempt — a
  // collision there is a real duplicate the caller must see, not something
  // to retry past. An auto-generated one is safe to regenerate and retry:
  // the count-based generator can race under concurrent creates, and the
  // @@unique([schoolId, admissionNumber]) constraint is the backstop that
  // catches it.
  const maxAttempts = explicitAdmissionNumber ? 1 : MAX_ADMISSION_NUMBER_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const admissionNumber = explicitAdmissionNumber ?? (await generateAdmissionNumber(tx, schoolId));
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
        },
        // Serializable only matters for the racy count()-based generator —
        // an explicit (import-supplied) number has nothing to race against
        // and the extra isolation would only cost throughput for no benefit.
        explicitAdmissionNumber ? undefined : { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      if (explicitAdmissionNumber || !isRetryableAdmissionNumberError(error) || isLastAttempt) {
        throw error;
      }
      // Another request generated (P2002) or overlapped with (P2034) this
      // attempt — loop back and generate a fresh number in a fresh
      // transaction.
    }
  }

  // Unreachable — the loop always returns or throws — but keeps TypeScript
  // happy about a guaranteed return type.
  throw new Error("Could not generate a unique admission number.");
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
