import { prisma } from "@/lib/db";
import { ensurePartnerRole } from "@/lib/platform-provisioning";
import type { PartnerStatus } from "@/generated/prisma/client";

const TEST_PREFIX = "vitest-partner-";

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/// A bare-bones Partner + its backing User (schoolId null, Role "PARTNER"
/// — the same global-role pattern SUPER_ADMIN uses), for exercising the
/// Partner Program services directly without going through the self-serve
/// application form.
export async function createTestPartner(opts: { status?: PartnerStatus } = {}) {
  const role = await ensurePartnerRole();
  const suffix = uniqueSuffix();
  const user = await prisma.user.create({
    data: {
      schoolId: null,
      roleId: role.id,
      email: `${TEST_PREFIX}${suffix}@example.com`,
      name: `Test Partner ${suffix}`,
      passwordHash: "not-a-real-hash",
    },
  });
  const partner = await prisma.partner.create({
    data: {
      userId: user.id,
      partnerCode: `VITESTP${suffix}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
      displayName: user.name,
      status: opts.status ?? "ACTIVE",
    },
  });
  return { user, partner };
}

/// Deletes every Partner-Program row this test run (or a prior crashed
/// one) created. School-scoped rows (PartnerReferral, CommercialAgreement,
/// PartnerCommission) already cascade away with their test School via
/// cleanupTestSchools() — this only needs to clean up what's keyed by
/// Partner/User instead, in FK-dependency order.
export async function cleanupTestPartners() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: TEST_PREFIX } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const partners = await prisma.partner.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const partnerIds = partners.map((p) => p.id);

  if (partnerIds.length > 0) {
    const withdrawals = await prisma.partnerWithdrawal.findMany({ where: { partnerId: { in: partnerIds } }, select: { id: true } });
    const withdrawalIds = withdrawals.map((w) => w.id);
    await prisma.partnerWithdrawalAllocation.deleteMany({ where: { withdrawalId: { in: withdrawalIds } } });

    const commissions = await prisma.partnerCommission.findMany({ where: { partnerId: { in: partnerIds } }, select: { id: true } });
    const commissionIds = commissions.map((c) => c.id);
    await prisma.partnerCommissionReversal.deleteMany({ where: { commissionId: { in: commissionIds } } });
    await prisma.partnerCommission.deleteMany({ where: { partnerId: { in: partnerIds } } });

    await prisma.partnerWithdrawal.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.commercialAgreement.updateMany({ where: { partnerId: { in: partnerIds } }, data: { partnerId: null } });
    await prisma.partnerReferral.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
  }

  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
