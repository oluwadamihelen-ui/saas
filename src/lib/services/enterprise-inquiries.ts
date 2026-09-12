import "server-only";
import { prisma } from "@/lib/db";

export interface EnterpriseInquiryInput {
  schoolOrGroupName: string;
  contactName: string;
  email: string;
  phone: string;
  studentCount?: number | null;
  campusCount?: number | null;
  currentSoftware?: string | null;
  requiredModules?: string | null;
  message?: string | null;
}

/// Public entry point from the pricing page's "Talk to us" form (spec: an
/// Enterprise inquiry is stored for a human to follow up on — it never
/// auto-creates a Subscription/SubscriptionPlan on its own).
export async function createEnterpriseInquiry(input: EnterpriseInquiryInput) {
  return prisma.enterpriseInquiry.create({
    data: {
      schoolOrGroupName: input.schoolOrGroupName,
      contactName: input.contactName,
      email: input.email.toLowerCase().trim(),
      phone: input.phone,
      studentCount: input.studentCount ?? null,
      campusCount: input.campusCount ?? null,
      currentSoftware: input.currentSoftware || null,
      requiredModules: input.requiredModules || null,
      message: input.message || null,
    },
  });
}

export async function listEnterpriseInquiries() {
  return prisma.enterpriseInquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: { reviewedBy: true },
  });
}

export async function markEnterpriseInquiryReviewed(inquiryId: string, reviewerId: string, status: "CONTACTED" | "CONVERTED" | "DECLINED") {
  return prisma.enterpriseInquiry.update({
    where: { id: inquiryId },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
  });
}
