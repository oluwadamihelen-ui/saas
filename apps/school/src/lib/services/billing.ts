import "server-only";
import { prisma } from "@/lib/db";

/// The school's own read-only view of its platform subscription — distinct
/// from src/lib/services/platform.ts, which is Super-Admin-scoped and can
/// see/change every school's billing.
export async function getSchoolBilling(schoolId: string) {
  return prisma.subscription.findUnique({
    where: { schoolId },
    include: {
      plan: true,
      invoices: { orderBy: { periodStart: "desc" } },
    },
  });
}
