import type { SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getHostingProvider } from "@/lib/providers/registry";
import { recordAuditLog } from "@/lib/security/audit";
import { notifyUser } from "@/lib/services/notifications";

const OPEN_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE", "TRIAL"];

/**
 * Upgrades or downgrades a hosting account to a different plan: calls the
 * registrar-style provider (upgradePlan/downgradePlan, chosen by comparing
 * HostingPlan.sortOrder), updates the account, and re-prices its linked
 * Subscription so the next billing cycle charges the new plan's rate --
 * takes effect immediately, at the new price starting next cycle, rather
 * than prorating the current one.
 */
export async function changeHostingPlan(accountId: string, newPlanId: string, actorId: string, options?: { byAdmin?: boolean }) {
  const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId }, include: { hostingPlan: true } });
  const newPlan = await prisma.hostingPlan.findUniqueOrThrow({ where: { id: newPlanId } });

  if (newPlan.id === account.hostingPlanId) throw new Error("Already on this plan");
  if (!newPlan.isActive) throw new Error("This plan is not currently available");
  if (!account.providerAccountId) throw new Error("Hosting account has no provider reference");

  const isUpgrade = newPlan.sortOrder > account.hostingPlan.sortOrder;
  const provider = await getHostingProvider();
  const newPlanCode = newPlan.providerPlanCode ?? newPlan.slug;
  if (isUpgrade) {
    await provider.upgradePlan(account.providerAccountId, newPlanCode);
  } else {
    await provider.downgradePlan(account.providerAccountId, newPlanCode);
  }

  await prisma.hostingAccount.update({ where: { id: accountId }, data: { hostingPlanId: newPlan.id } });

  const subscription = await prisma.subscription.findFirst({
    where: { type: "HOSTING", referenceId: accountId, status: { in: OPEN_SUBSCRIPTION_STATUSES } },
  });
  if (subscription) {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { amount: newPlan.priceMonthly } });
  }

  await recordAuditLog({
    actorId,
    action: isUpgrade ? "hosting.upgraded" : "hosting.downgraded",
    resourceType: "HostingAccount",
    resourceId: accountId,
    oldValue: { plan: account.hostingPlan.name },
    newValue: { plan: newPlan.name, byAdmin: options?.byAdmin ?? false },
  });
  await notifyUser(account.customerId, {
    type: isUpgrade ? "hosting.upgraded" : "hosting.downgraded",
    title: isUpgrade ? "Hosting plan upgraded" : "Hosting plan downgraded",
    message: `Your hosting account is now on the ${newPlan.name} plan. The new price applies from your next billing date.`,
  });

  return prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId }, include: { hostingPlan: true } });
}

/** Admin ops action -- e.g. for a policy violation or a manual nonpayment hold. */
export async function suspendHostingAccount(accountId: string, actorId: string) {
  const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (!account.providerAccountId) throw new Error("Hosting account has no provider reference");

  const provider = await getHostingProvider();
  await provider.suspendAccount(account.providerAccountId);
  await prisma.hostingAccount.update({ where: { id: accountId }, data: { status: "SUSPENDED" } });

  await recordAuditLog({ actorId, action: "hosting.suspended", resourceType: "HostingAccount", resourceId: accountId });
  await notifyUser(account.customerId, {
    type: "hosting.suspended",
    title: "Hosting account suspended",
    message: "Your hosting account has been suspended. Contact support for details.",
  });
}

export async function unsuspendHostingAccount(accountId: string, actorId: string) {
  const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (!account.providerAccountId) throw new Error("Hosting account has no provider reference");

  const provider = await getHostingProvider();
  await provider.unsuspendAccount(account.providerAccountId);
  await prisma.hostingAccount.update({ where: { id: accountId }, data: { status: "ACTIVE" } });

  await recordAuditLog({ actorId, action: "hosting.unsuspended", resourceType: "HostingAccount", resourceId: accountId });
  await notifyUser(account.customerId, {
    type: "hosting.unsuspended",
    title: "Hosting account reactivated",
    message: "Your hosting account is active again.",
  });
}

/** Cancels the account for good -- available to the customer themselves or an admin. */
export async function terminateHostingAccount(accountId: string, actorId: string, options?: { byAdmin?: boolean }) {
  const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } });

  const provider = await getHostingProvider();
  if (account.providerAccountId) await provider.deleteAccount(account.providerAccountId);

  await prisma.hostingAccount.update({ where: { id: accountId }, data: { status: "TERMINATED" } });

  const subscription = await prisma.subscription.findFirst({
    where: { type: "HOSTING", referenceId: accountId, status: { in: OPEN_SUBSCRIPTION_STATUSES } },
  });
  if (subscription) {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  }

  await recordAuditLog({
    actorId,
    action: "hosting.terminated",
    resourceType: "HostingAccount",
    resourceId: accountId,
    newValue: { byAdmin: options?.byAdmin ?? false },
  });
  await notifyUser(account.customerId, {
    type: "hosting.terminated",
    title: "Hosting account cancelled",
    message: "Your hosting account has been cancelled and will no longer be billed.",
  });
}
