import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { upgradeDeployment } from "@/lib/services/deployments";
import { getOrCreateMockTarget } from "@/lib/services/deployment-targets";

/**
 * Phase 7 acceptance test for the in-app version-upgrade flow: a customer
 * moves a live (COMPLETED) deployment to a different already-published
 * version of the same application. Mirrors the admin rollbackDeployment
 * lineage pattern -- the old deployment is marked UPGRADED (not deleted)
 * and a fresh deployment is queued with previousDeploymentId set, so the
 * upgrade goes through the same async pipeline as any other deployment.
 */
const SUFFIX = `upgrade-${Date.now()}`;

describe("deployment upgrade: move a live deployment to a different published version", () => {
  let categoryId: string;
  let applicationId: string;
  let customerId: string;
  let v1Id: string;
  let v2Id: string;
  let deploymentId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });

    const category = await prisma.category.create({ data: { name: `Upgrade Test ${SUFFIX}`, slug: `upgrade-test-${SUFFIX}` } });
    categoryId = category.id;

    const customer = await prisma.user.create({
      data: { name: "Upgrade Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const application = await prisma.application.create({
      data: {
        name: `Upgrade Test App ${SUFFIX}`,
        slug: `upgrade-test-app-${SUFFIX}`,
        categoryId,
        shortDescription: "Test",
        fullDescription: "Test",
        status: "PUBLISHED",
        pricing: { create: { type: "LICENSE", name: "License", amount: 99, billingCycle: "ONE_TIME" } },
      },
    });
    applicationId = application.id;

    const specData = { runtime: "node20", buildCommand: "npm run build", startCommand: "npm start", environmentVariables: [] };
    const v1 = await prisma.applicationVersion.create({
      data: { application: { connect: { id: application.id } }, version: "1.0.0", status: "STABLE", isLatest: false, isStable: true, deploymentSpecification: { create: specData } },
    });
    v1Id = v1.id;
    const v2 = await prisma.applicationVersion.create({
      data: { application: { connect: { id: application.id } }, version: "2.0.0", status: "STABLE", isLatest: true, isStable: true, deploymentSpecification: { create: specData } },
    });
    v2Id = v2.id;

    await prisma.applicationLicense.create({
      data: { licenseKey: `TEST-${SUFFIX}`, customerId, applicationId, status: "ACTIVE" },
    });

    const target = await getOrCreateMockTarget(customerId);
    const deployment = await prisma.deployment.create({
      data: { customerId, applicationId, applicationVersionId: v1Id, type: "MANAGED", status: "COMPLETED", deploymentTargetId: target.id },
    });
    deploymentId = deployment.id;
  });

  afterAll(async () => {
    if (!categoryId || !applicationId || !customerId) return;

    const deployments = await prisma.deployment.findMany({ where: { customerId }, select: { id: true, deploymentTargetId: true } });
    const deploymentIds = deployments.map((d) => d.id);
    const targetIds = deployments.map((d) => d.deploymentTargetId).filter((id): id is string => Boolean(id));
    await prisma.deploymentLog.deleteMany({ where: { deploymentId: { in: deploymentIds } } });
    await prisma.deploymentJob.deleteMany({ where: { deploymentId: { in: deploymentIds } } });
    await prisma.deployment.deleteMany({ where: { id: { in: deploymentIds } } });
    await prisma.deploymentTarget.deleteMany({ where: { id: { in: targetIds } } });
    await prisma.applicationLicense.deleteMany({ where: { customerId } });
    await prisma.applicationVersion.deleteMany({ where: { applicationId } });
    await prisma.applicationPricing.deleteMany({ where: { applicationId } });
    await prisma.application.delete({ where: { id: applicationId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("rejects upgrading to the version it's already running", async () => {
    await expect(upgradeDeployment(customerId, deploymentId, v1Id)).rejects.toThrow(/already running/i);
  });

  it("queues a new deployment on the target version and marks the old one UPGRADED", async () => {
    const upgraded = await upgradeDeployment(customerId, deploymentId, v2Id);

    expect(upgraded.applicationVersionId).toBe(v2Id);
    expect(upgraded.previousDeploymentId).toBe(deploymentId);
    expect(upgraded.status).toBe("QUEUED");

    const old = await prisma.deployment.findUniqueOrThrow({ where: { id: deploymentId } });
    expect(old.status).toBe("UPGRADED");

    const auditLog = await prisma.auditLog.findFirst({ where: { resourceId: deploymentId, action: "deployment.upgraded" } });
    expect(auditLog).not.toBeNull();
  });

  it("rejects upgrading a deployment that is no longer COMPLETED", async () => {
    await expect(upgradeDeployment(customerId, deploymentId, v2Id)).rejects.toThrow(/live deployment/i);
  });

  it("rejects an upgrade target that isn't a published (isStable) version", async () => {
    const draftVersion = await prisma.applicationVersion.create({
      data: { application: { connect: { id: applicationId } }, version: "3.0.0-beta", status: "DRAFT", isLatest: false, isStable: false },
    });

    const target = await getOrCreateMockTarget(customerId);
    const liveDeployment = await prisma.deployment.create({
      data: { customerId, applicationId, applicationVersionId: v2Id, type: "MANAGED", status: "COMPLETED", deploymentTargetId: target.id },
    });

    await expect(upgradeDeployment(customerId, liveDeployment.id, draftVersion.id)).rejects.toThrow(/not available/i);
  });
}, 30000);
