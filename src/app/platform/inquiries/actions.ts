"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, withAuthErrors } from "@/lib/auth/require";
import { markEnterpriseInquiryReviewed } from "@/lib/services/enterprise-inquiries";
import { convertInquiryToBuyer } from "@/lib/services/buyer-onboarding";
import { logAudit } from "@/lib/audit";

export async function markInquiryReviewedAction(inquiryId: string, status: "CONTACTED" | "CONVERTED" | "DECLINED") {
  const admin = await requireSuperAdmin();
  await markEnterpriseInquiryReviewed(inquiryId, admin.id, status);
  await logAudit({
    schoolId: null,
    userId: admin.id,
    action: "platform.enterprise_inquiry_reviewed",
    resourceType: "EnterpriseInquiry",
    resourceId: inquiryId,
    newValue: { status },
  });
  revalidatePath("/platform/inquiries");
}

export interface ConvertToBuyerState {
  status: "idle" | "error" | "success";
  message?: string;
  credentials?: { email: string; temporaryPassword: string };
}

const convertSchema = z.object({
  inquiryId: z.string().trim().min(1),
  displayName: z.string().trim().min(1, "A name is required"),
  phone: z.string().trim().optional().or(z.literal("")),
});

/// This school/company wants to buy Schoolum outright to install and run
/// independently — never a School tenant here (see Buyer's own doc
/// comment). Creates the Buyer account immediately, atomically marking the
/// inquiry CONVERTED, and returns a one-time temporary password for the
/// Super Admin to copy and share with the buyer themselves — there is no
/// email provider in this app, so this is the only place that password is
/// ever visible.
export const convertInquiryToBuyerAction = withAuthErrors(async function convertInquiryToBuyerAction(_prev: ConvertToBuyerState, formData: FormData): Promise<ConvertToBuyerState> {
  const admin = await requireSuperAdmin();
  const parsed = convertSchema.safeParse({
    inquiryId: formData.get("inquiryId"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    const result = await convertInquiryToBuyer({
      inquiryId: parsed.data.inquiryId,
      createdById: admin.id,
      displayName: parsed.data.displayName,
      phone: parsed.data.phone || null,
    });
    revalidatePath("/platform/inquiries");
    revalidatePath("/platform/buyers");
    return { status: "success", credentials: { email: result.user.email, temporaryPassword: result.temporaryPassword } };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not convert this inquiry to a Buyer account." };
  }
});
