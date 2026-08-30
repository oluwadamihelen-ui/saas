import { prisma } from "@/lib/prisma";
import { TenantError } from "@/lib/errors";

export async function getActivePlan(businessId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });
  if (subscription) return subscription.plan;
  // Fall back to FREE if no subscription row exists yet.
  return prisma.plan.findUnique({ where: { key: "FREE" } });
}

export async function assertProductLimit(businessId: string) {
  const plan = await getActivePlan(businessId);
  if (!plan || plan.productLimit == null) return;
  const count = await prisma.product.count({ where: { businessId } });
  if (count >= plan.productLimit) {
    throw new TenantError(
      `Your ${plan.name} plan allows up to ${plan.productLimit} products. Upgrade to add more.`,
      402
    );
  }
}

export async function assertAiMessageLimit(businessId: string) {
  const plan = await getActivePlan(businessId);
  if (!plan || plan.aiMessageLimitPerMonth == null) return;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await prisma.aIMessage.count({
    where: {
      role: "USER",
      conversation: { businessId },
      createdAt: { gte: startOfMonth },
    },
  });
  if (count >= plan.aiMessageLimitPerMonth) {
    throw new TenantError(
      `Your ${plan.name} plan allows ${plan.aiMessageLimitPerMonth} Mama AI messages per month. Upgrade for more.`,
      402
    );
  }
}
