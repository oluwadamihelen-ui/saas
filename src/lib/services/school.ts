import "server-only";
import { prisma } from "@/lib/db";

export type OnboardingStep = "school-info" | "academic-structure" | "invite-staff" | "done";

export async function getSchool(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error("School not found");
  return school;
}

export function nextOnboardingStep(school: {
  schoolInfoCompletedAt: Date | null;
  academicStructureSetupAt: Date | null;
  staffInvitedAt: Date | null;
  onboardingCompletedAt: Date | null;
}): OnboardingStep {
  if (school.onboardingCompletedAt) return "done";
  if (!school.schoolInfoCompletedAt) return "school-info";
  if (!school.academicStructureSetupAt) return "academic-structure";
  if (!school.staffInvitedAt) return "invite-staff";
  return "done";
}

export async function updateSchoolInfo(
  schoolId: string,
  data: {
    logoUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    country: string;
    currency: string;
    timezone: string;
  }
) {
  return prisma.school.update({
    where: { id: schoolId },
    data: { ...data, schoolInfoCompletedAt: new Date() },
  });
}

export async function markStaffInvitedStepDone(schoolId: string) {
  return prisma.school.update({
    where: { id: schoolId },
    data: { staffInvitedAt: new Date(), onboardingCompletedAt: new Date(), status: "ACTIVE" },
  });
}
