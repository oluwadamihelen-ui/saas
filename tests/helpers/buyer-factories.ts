import { prisma } from "@/lib/db";
import { ensureBuyerRole } from "@/lib/platform-provisioning";
import { createEnterpriseInquiry } from "@/lib/services/enterprise-inquiries";

const TEST_PREFIX = "vitest-buyer-";

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/// A bare-bones Buyer + backing User (schoolId null, Role "BUYER") and its
/// source EnterpriseInquiry, for exercising the Buyer Program services
/// directly without going through the platform admin "Convert to Buyer"
/// action UI.
export async function createTestBuyer() {
  const role = await ensureBuyerRole();
  const suffix = uniqueSuffix();
  const inquiry = await createEnterpriseInquiry({
    schoolOrGroupName: `Test Buyer Co ${suffix}`,
    contactName: `Test Contact ${suffix}`,
    email: `${TEST_PREFIX}${suffix}@example.com`,
    phone: "+2340000000000",
  });
  const user = await prisma.user.create({
    data: {
      schoolId: null,
      roleId: role.id,
      email: inquiry.email,
      name: `Test Buyer ${suffix}`,
      passwordHash: "not-a-real-hash",
    },
  });
  const buyer = await prisma.buyer.create({
    data: { userId: user.id, displayName: user.name, sourceInquiryId: inquiry.id, createdById: user.id },
  });
  return { user, buyer, inquiry };
}

/// Deletes every Buyer-Program row this test run (or a prior crashed one)
/// created, in FK-dependency order.
export async function cleanupTestBuyers() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: TEST_PREFIX } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const buyers = await prisma.buyer.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const buyerIds = buyers.map((b) => b.id);

  if (buyerIds.length > 0) {
    await prisma.buyerInvoice.deleteMany({ where: { buyerId: { in: buyerIds } } });
    const agreements = await prisma.buyerAgreement.findMany({ where: { buyerId: { in: buyerIds } }, select: { id: true } });
    await prisma.buyerProgressUpdate.deleteMany({ where: { buyerAgreementId: { in: agreements.map((a) => a.id) } } });
    await prisma.buyerAgreement.deleteMany({ where: { buyerId: { in: buyerIds } } });
    await prisma.buyer.deleteMany({ where: { id: { in: buyerIds } } });
  }

  const inquiries = await prisma.enterpriseInquiry.findMany({ where: { email: { startsWith: TEST_PREFIX } }, select: { id: true } });
  await prisma.enterpriseInquiry.deleteMany({ where: { id: { in: inquiries.map((i) => i.id) } } });

  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
