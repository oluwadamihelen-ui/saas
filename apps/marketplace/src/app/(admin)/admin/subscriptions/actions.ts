"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPaymentProvider } from "@/lib/providers/registry";
import { recordAuditLog } from "@/lib/security/audit";
import { notifyUser } from "@/lib/services/notifications";

export async function cancelSubscriptionAdmin(subscriptionId: string) {
  const user = await requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE);

  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });

  if (subscription.providerSubscriptionId) {
    const provider = await getPaymentProvider();
    if (provider.capabilities.supportsSubscriptions && provider.cancelSubscription) {
      await provider.cancelSubscription(subscription.providerSubscriptionId);
    }
  }

  await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELLED", cancelledAt: new Date() } });

  await recordAuditLog({ actorId: user.id, action: "subscription.cancelled", resourceType: "Subscription", resourceId: subscriptionId });
  await notifyUser(subscription.customerId, {
    type: "subscription.cancelled",
    title: "Subscription cancelled",
    message: `Your ${subscription.type.toLowerCase()} subscription has been cancelled.`,
  });

  revalidatePath("/admin/subscriptions");
}
