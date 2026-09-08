import "server-only";
import { prisma } from "@/lib/db";
import { createStudent } from "@/lib/services/students";
import type { Gender, Prisma, ApplicantStatus } from "@/generated/prisma/client";

export async function getAdmissionFee(schoolId: string) {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { admissionFeeMinor: true, currency: true } });
  return school;
}

/// Public entry point for the unauthenticated /apply/[slug] form — only
/// the fields that page needs to render are selected.
export async function getSchoolBySlug(slug: string) {
  return prisma.school.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      currency: true,
      admissionFeeMinor: true,
      bankName: true,
      bankAccountName: true,
      bankAccountNumber: true,
    },
  });
}

/// Public entry point for the /apply/[slug]/[applicantId] confirmation
/// page — scoped by schoolId (derived from the slug in the URL) so one
/// applicant's page can't be used to probe another school's data.
export async function getApplicantPublic(schoolId: string, id: string) {
  return prisma.applicant.findFirst({
    where: { id, schoolId },
    select: {
      id: true,
      childFirstName: true,
      childLastName: true,
      admissionFeeMinor: true,
      feeStatus: true,
    },
  });
}

export async function setAdmissionFee(schoolId: string, admissionFeeMinor: number | null) {
  return prisma.school.update({ where: { id: schoolId }, data: { admissionFeeMinor } });
}

export interface ApplicationInput {
  childFirstName: string;
  childLastName: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  desiredClassGroupId?: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  addressLine?: string | null;
}

/// Public entry point (the /apply/[slug] form has no session) — snapshots
/// the school's current admission fee onto the applicant so a later fee
/// change never rewrites an in-flight application.
export async function submitApplication(schoolId: string, input: ApplicationInput) {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { admissionFeeMinor: true } });

  return prisma.applicant.create({
    data: {
      schoolId,
      childFirstName: input.childFirstName,
      childLastName: input.childLastName,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      desiredClassGroupId: input.desiredClassGroupId || null,
      parentName: input.parentName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone,
      addressLine: input.addressLine || null,
      admissionFeeMinor: school.admissionFeeMinor,
      feeStatus: school.admissionFeeMinor ? "UNPAID" : "PAID",
    },
  });
}

const APPLICANT_PAGE_SIZE = 20;

export async function listApplicants(schoolId: string, status: ApplicantStatus | undefined, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.ApplicantWhereInput = { schoolId, ...(status ? { status } : {}) };
  const [applicants, total] = await Promise.all([
    prisma.applicant.findMany({
      where,
      include: { desiredClassGroup: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * APPLICANT_PAGE_SIZE,
      take: APPLICANT_PAGE_SIZE,
    }),
    prisma.applicant.count({ where }),
  ]);
  return { applicants, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / APPLICANT_PAGE_SIZE)) };
}

export async function getApplicant(schoolId: string, id: string) {
  return prisma.applicant.findFirst({
    where: { id, schoolId },
    include: { desiredClassGroup: true, reviewedBy: true, enrolledStudent: true },
  });
}

const NEXT_STATUS: Record<string, string[]> = {
  APPLIED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["OFFERED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  ENROLLED: [],
};

export async function updateApplicantStatus(
  schoolId: string,
  id: string,
  status: "UNDER_REVIEW" | "OFFERED" | "ACCEPTED" | "REJECTED",
  reviewedById: string,
  notes?: string | null
) {
  const applicant = await prisma.applicant.findFirst({ where: { id, schoolId } });
  if (!applicant) throw new Error("Applicant not found.");
  if (!NEXT_STATUS[applicant.status]?.includes(status)) {
    throw new Error(`Can't move from ${applicant.status} to ${status}.`);
  }

  return prisma.applicant.update({
    where: { id },
    data: { status, reviewedById, notes: notes ?? applicant.notes },
  });
}

/// The applicant/parent confirming a bank transfer was made — mirrors the
/// same "notify a transfer for staff to confirm" pattern the public
/// /pay/[token] invoice flow already uses (PENDING_CONFIRMATION, not PAID,
/// until staff verifies).
export async function markApplicationFeePendingConfirmation(schoolId: string, id: string) {
  const applicant = await prisma.applicant.findFirst({ where: { id, schoolId } });
  if (!applicant) throw new Error("Application not found.");
  if (applicant.feeStatus !== "UNPAID") throw new Error("This fee isn't awaiting payment.");
  return prisma.applicant.update({ where: { id }, data: { feeStatus: "PENDING_CONFIRMATION" } });
}

export async function confirmApplicationFeePaid(schoolId: string, id: string) {
  const applicant = await prisma.applicant.findFirst({ where: { id, schoolId } });
  if (!applicant) throw new Error("Application not found.");
  return prisma.applicant.update({ where: { id }, data: { feeStatus: "PAID", feePaidAt: new Date() } });
}

/// "Full Admission Process": creates the real Student row (reusing the
/// same createStudent path enrollment already uses, admission-number
/// generation included) and links it back to this applicant. A specific
/// class ARM is asked for here rather than reused from
/// desiredClassGroupId, since that only ever captured a grade level, not
/// which stream — that decision naturally happens at admission time, not
/// application time.
export async function admitApplicant(schoolId: string, id: string, classArmId?: string | null) {
  const applicant = await prisma.applicant.findFirst({ where: { id, schoolId } });
  if (!applicant) throw new Error("Applicant not found.");
  if (applicant.status !== "ACCEPTED") throw new Error("Only an accepted applicant can be admitted.");
  if (applicant.enrolledStudentId) throw new Error("This applicant has already been admitted.");

  const spaceIndex = applicant.parentName.indexOf(" ");
  const guardianFirstName = spaceIndex === -1 ? applicant.parentName : applicant.parentName.slice(0, spaceIndex);
  const guardianLastName = spaceIndex === -1 ? "" : applicant.parentName.slice(spaceIndex + 1);

  const student = await createStudent(schoolId, {
    firstName: applicant.childFirstName,
    lastName: applicant.childLastName,
    dateOfBirth: applicant.dateOfBirth,
    gender: applicant.gender,
    addressLine: applicant.addressLine,
    classArmId: classArmId || null,
    guardian: {
      firstName: guardianFirstName,
      lastName: guardianLastName || guardianFirstName,
      phone: applicant.parentPhone,
      email: applicant.parentEmail,
      relationship: "GUARDIAN",
    },
  });

  await prisma.applicant.update({ where: { id }, data: { status: "ENROLLED", enrolledStudentId: student.id } });
  return student;
}
