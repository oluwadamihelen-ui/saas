"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { updateApplicantStatus, confirmApplicationFeePaid, admitApplicant } from "@/lib/services/admission";
import { logAudit } from "@/lib/audit";

export interface AdmissionActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

const statusSchema = z.object({
  applicantId: z.string().min(1),
  status: z.enum(["UNDER_REVIEW", "OFFERED", "ACCEPTED", "REJECTED"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

export async function updateApplicantStatusAction(_prev: AdmissionActionState, formData: FormData): Promise<AdmissionActionState> {
  const user = await requirePermission(PERMISSIONS.ADMISSION_MANAGE);
  const parsed = statusSchema.safeParse({
    applicantId: formData.get("applicantId"),
    status: formData.get("status"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Please check your details." };

  try {
    await updateApplicantStatus(user.schoolId, parsed.data.applicantId, parsed.data.status, user.id, parsed.data.notes || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update this applicant." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "admission.status_updated",
    resourceType: "Applicant",
    resourceId: parsed.data.applicantId,
  });
  revalidatePath("/dashboard/administration/admission");
  revalidatePath(`/dashboard/administration/admission/${parsed.data.applicantId}`);
  return { status: "success" };
}

export async function confirmApplicationFeePaidAction(applicantId: string) {
  const user = await requirePermission(PERMISSIONS.ADMISSION_MANAGE);
  await confirmApplicationFeePaid(user.schoolId, applicantId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "admission.fee_confirmed", resourceType: "Applicant", resourceId: applicantId });
  revalidatePath(`/dashboard/administration/admission/${applicantId}`);
}

const admitSchema = z.object({
  applicantId: z.string().min(1),
  classArmId: z.string().trim().optional().or(z.literal("")),
});

export async function admitApplicantAction(_prev: AdmissionActionState, formData: FormData): Promise<AdmissionActionState> {
  const user = await requirePermission(PERMISSIONS.ADMISSION_MANAGE);
  const parsed = admitSchema.safeParse({
    applicantId: formData.get("applicantId"),
    classArmId: formData.get("classArmId") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Please check your details." };

  try {
    await admitApplicant(user.schoolId, parsed.data.applicantId, parsed.data.classArmId || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not admit this applicant." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "admission.applicant_admitted",
    resourceType: "Applicant",
    resourceId: parsed.data.applicantId,
  });
  revalidatePath("/dashboard/administration/admission");
  revalidatePath(`/dashboard/administration/admission/${parsed.data.applicantId}`);
  revalidatePath("/dashboard/students");
  return { status: "success" };
}
