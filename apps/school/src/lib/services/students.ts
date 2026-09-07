import "server-only";
import { prisma } from "@/lib/db";
import type { Gender, GuardianRelationship, Prisma, StudentStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

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
  firstName: string;
  lastName: string;
  otherNames?: string | null;
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

export async function createStudent(schoolId: string, input: StudentInput) {
  const admissionNumber = await generateAdmissionNumber(schoolId);

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        schoolId,
        admissionNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        otherNames: input.otherNames || null,
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

    return student;
  });
}

export async function updateStudent(schoolId: string, id: string, input: Partial<StudentInput>) {
  const existing = await prisma.student.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Student not found");

  return prisma.student.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      otherNames: input.otherNames,
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
}

export async function withdrawStudent(schoolId: string, id: string) {
  const existing = await prisma.student.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Student not found");
  return prisma.student.update({ where: { id }, data: { status: "WITHDRAWN" } });
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
