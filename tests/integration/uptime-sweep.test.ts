import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { runUptimeSweep } from "@/lib/services/uptime-monitor";
import { getOrCreateMockTarget } from "@/lib/services/deployment-targets";

/**
 * Phase 7 acceptance test for the recurring uptime re-check (the sweep that
 * keeps Deployment.healthStatus current after the one-time post-deploy
 * check). The mock deployment adapter always reports healthy, so a
 * deployment seeded OFFLINE gives the sweep's OFFLINE -> HEALTHY recovery
 * path something real to catch, including the customer notification --
 * while an already-HEALTHY deployment should just get its
 * lastHealthCheckAt refreshed, with no spurious transition notification.
 */
const SUFFIX = `uptime-${Date.now()}`;

describe("runUptimeSweep", () => {
  let categoryId: string;
  let applicationId: string;
  let customerId: string;
  let offlineDeploymentId: string;
  let healthyDeploymentId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const category = await prisma.category.create({ data: { name: `Uptime Test ${SUFFIX}`, slug: `uptime-test-${SUFFIX}` } });
    categoryId = category.id;
    const customer = await prisma.user.create({ data: { name: "Uptime Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" } });
    customerId = customer.id;
    const application = await prisma.application.create({
      data: { name: `Uptime Test App ${SUFFIX}`, slug: `uptime-test-app-${SUFFIX}`, categoryId, shortDescription: "Test", fullDescription: "Test", status: "PUBLISHED" },
    });
    applicationId = application.id;
    const version = await prisma.applicationVersion.create({
      data: { application: { connect: { id: application.id } }, version: "1.0.0", status: "STABLE", isLatest: true, isStable: true },
    });

    const target = await getOrCreateMockTarget(customerId);

    const offlineDeployment = await prisma.deployment.create({
      data: {
        customerId,
        applicationId,
        applicationVersionId: version.id,
        type: "MANAGED",
        status: "COMPLETED",
        healthStatus: "OFFLINE",
        lastHealthCheckAt: new Date(Date.now() - 60 * 60 * 1000),
        deploymentTargetId: target.id,
      },
    });
    offlineDeploymentId = offlineDeployment.id;

    const healthyDeployment = await prisma.deployment.create({
      data: {
        customerId,
        applicationId,
        applicationVersionId: version.id,
        type: "MANAGED",
        status: "COMPLETED",
        healthStatus: "HEALTHY",
        lastHealthCheckAt: new Date(Date.now() - 60 * 60 * 1000),
        deploymentTargetId: target.id,
      },
    });
    healthyDeploymentId = healthyDeployment.id;
  });

  afterAll(async () => {
    if (!categoryId || !applicationId || !customerId) return;

    const deployments = await prisma.deployment.findMany({ where: { customerId }, select: { id: true, deploymentTargetId: true } });
    const deploymentIds = deployments.map((d) => d.id);
    const targetIds = deployments.map((d) => d.deploymentTargetId).filter((id): id is string => Boolean(id));
    await prisma.deployment.deleteMany({ where: { id: { in: deploymentIds } } });
    await prisma.deploymentTarget.deleteMany({ where: { id: { in: targetIds } } });
    await prisma.applicationVersion.deleteMany({ where: { applicationId } });
    await prisma.application.delete({ where: { id: applicationId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("flips an OFFLINE deployment back to HEALTHY and notifies the customer it recovered", async () => {
    const before = await prisma.deployment.findUniqueOrThrow({ where: { id: offlineDeploymentId } });
    expect(before.healthStatus).toBe("OFFLINE");

    const result = await runUptimeSweep();
    expect(result.checked).toBeGreaterThanOrEqual(2);
    expect(result.recovered).toBeGreaterThanOrEqual(1);

    const after = await prisma.deployment.findUniqueOrThrow({ where: { id: offlineDeploymentId } });
    expect(after.healthStatus).toBe("HEALTHY");
    expect(after.lastHealthCheckAt!.getTime()).toBeGreaterThan(before.lastHealthCheckAt!.getTime());

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "deployment.recovered" } });
    expect(notification).not.toBeNull();

    const auditLog = await prisma.auditLog.findFirst({ where: { resourceId: offlineDeploymentId, action: "deployment.recovered" } });
    expect(auditLog).not.toBeNull();
  });

  it("refreshes an already-HEALTHY deployment without firing a spurious transition notification", async () => {
    const before = await prisma.deployment.findUniqueOrThrow({ where: { id: healthyDeploymentId } });

    await runUptimeSweep();

    const after = await prisma.deployment.findUniqueOrThrow({ where: { id: healthyDeploymentId } });
    expect(after.healthStatus).toBe("HEALTHY");
    expect(after.lastHealthCheckAt!.getTime()).toBeGreaterThan(before.lastHealthCheckAt!.getTime());

    const wentOfflineLog = await prisma.auditLog.findFirst({ where: { resourceId: healthyDeploymentId, action: "deployment.went_offline" } });
    expect(wentOfflineLog).toBeNull();
    const recoveredLog = await prisma.auditLog.findFirst({ where: { resourceId: healthyDeploymentId, action: "deployment.recovered" } });
    expect(recoveredLog).toBeNull();
  });
}, 30000);
