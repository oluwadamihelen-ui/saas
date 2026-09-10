"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require";
import { markEnterpriseInquiryReviewed } from "@/lib/services/enterprise-inquiries";
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
