import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { createOrder, markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";
import { createApplicationVersion } from "@/lib/services/application-versions";
import { processDeploymentPipeline } from "@/lib/queue/deploymentWorker";
import type { RunDeploymentPipelineJob } from "@/lib/queue/deploymentQueue";

/**
 * End-to-end acceptance test for the critical journey the spec calls out:
 * Application -> purchase -> payment -> order paid -> deployment requested
 * -> deployment job -> mock deployment -> health check -> completed. Runs
 * against the real local database/queue (this sandbox's dev Postgres and
 * Redis) rather than mocks, so it exercises the actual Prisma schema and
 * BullMQ job payload shape, not a stand-in for them.
 */
const SUFFIX = `test-${Date.now()}`;

describe("full purchase -> payment -> deployment flow", () => {
  let categoryId: string;
  let applicationId: string;
  let customerId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({
      where: { key: "CUSTOMER" },
      update: {},
      create: { key: "CUSTOMER", name: "Customer" },
    });

    const category = await prisma.category.create({
      data: { name: `Test Category ${SUFFIX}`, slug: `test-category-${SUFFIX}` },
    });
    categoryId = category.id;

    const customer = await prisma.user.create({
      data: { name: "Test Customer", email: `customer-${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const application = await prisma.application.create({
      data: {
        name: `Test App ${SUFFIX}`,
        slug: `test-app-${SUFFIX}`,
        shortDescription: "Test application for integration tests",
        fullDescription: "Test application for integration tests",
        categoryId,
        status: "PUBLISHED",
        pricing: { create: { type: "LICENSE", name: "License", amount: 199, billingCycle: "ONE_TIME" } },
      },
    });
    applicationId = application.id;

    await createApplicationVersion({
      applicationId,
      version: "1.0.0",
      status: "STABLE",
      isLatest: true,
      isStable: true,
      spec: {
        runtime: "node20",
        buildCommand: "npm run build",
        startCommand: "npm start",
        healthCheckPath: "/api/health",
        environmentVariables: [],
      },
    });
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before these ids were assigned --
    // an unscoped `where: { customerId: undefined }` matches every row in the
    // table, so without this a setup failure would wipe unrelated data.
    if (!customerId || !applicationId || !categoryId) return;

    const deployments = await prisma.deployment.findMany({ where: { customerId }, select: { id: true, deploymentTargetId: true } });
    const deploymentIds = deployments.map((d) => d.id);
    const targetIds = deployments.map((d) => d.deploymentTargetId).filter((id): id is string => Boolean(id));

    await prisma.deploymentLog.deleteMany({ where: { deploymentId: { in: deploymentIds } } });
    await prisma.deploymentJob.deleteMany({ where: { deploymentId: { in: deploymentIds } } });
    await prisma.deployment.deleteMany({ where: { id: { in: deploymentIds } } });
    await prisma.deploymentCredential.deleteMany({ where: { deploymentTargetId: { in: targetIds } } });
    await prisma.deploymentTarget.deleteMany({ where: { id: { in: targetIds } } });
    await prisma.applicationLicense.deleteMany({ where: { customerId } });

    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.paymentWebhookEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

    const versions = await prisma.applicationVersion.findMany({ where: { applicationId }, select: { id: true, deploymentSpecificationId: true } });
    await prisma.applicationArtifact.deleteMany({ where: { applicationVersionId: { in: versions.map((v) => v.id) } } });
    await prisma.applicationVersion.deleteMany({ where: { applicationId } });
    for (const v of versions) {
      if (v.deploymentSpecificationId) {
        await prisma.deploymentSpecification.delete({ where: { id: v.deploymentSpecificationId } }).catch(() => undefined);
      }
    }
    await prisma.applicationPricing.deleteMany({ where: { applicationId } });
    await prisma.application.delete({ where: { id: applicationId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("runs the full journey: order -> payment -> deployment -> health check -> completed", async () => {
    const order = await createOrder(
      customerId,
      [
        {
          type: "APPLICATION_LICENSE",
          applicationId,
          description: "Test App — Software License",
          billingCycle: "ONE_TIME",
          quantity: 1,
          unitPrice: 199,
        },
      ],
      { billingName: "Test Customer", billingEmail: `customer-${SUFFIX}@example.com` }
    );
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.paymentStatus).toBe("PENDING");

    // Payment amount must match the order total, or markOrderPaid rejects it.
    await expect(markOrderPaid(order.id, { provider: "mock", providerRef: `mock_bad_${SUFFIX}`, amount: 1, currency: order.currency })).rejects.toThrow();

    const paid = await markOrderPaid(order.id, { provider: "mock", providerRef: `mock_test_${SUFFIX}`, amount: 199, currency: order.currency });
    expect(paid?.paymentStatus).toBe("PAID");

    // Idempotent: calling it again with the same (already-paid) order is a no-op, not a duplicate charge/license.
    await markOrderPaid(order.id, { provider: "mock", providerRef: `mock_test_${SUFFIX}`, amount: 199, currency: order.currency });
    const licenseCount = await prisma.applicationLicense.count({ where: { orderId: order.id } });
    expect(licenseCount).toBe(1);

    const invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } });
    expect(invoice).not.toBeNull();
    expect(Number(invoice!.total)).toBe(199);
    expect(invoice!.status).toBe("PAID");

    const license = await prisma.applicationLicense.findFirst({ where: { orderId: order.id } });
    expect(license?.status).toBe("ACTIVE");

    await prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentIntent: {
          deploymentType: "MANAGED",
          serverHost: null,
          serverPort: null,
          controlPanel: null,
          domainName: null,
          hostingPlanId: null,
        },
      },
    });
    await fulfillOrder(order.id);

    const deployment = await prisma.deployment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(deployment.status).toBe("QUEUED");
    expect(deployment.applicationId).toBe(applicationId);

    const job = await prisma.deploymentJob.findFirstOrThrow({ where: { deploymentId: deployment.id } });

    // Run the pipeline directly (same function the BullMQ worker calls) instead
    // of waiting on a real worker process, so the test is deterministic.
    const fakeJob = { data: { deploymentId: deployment.id, deploymentJobId: job.id } } as Job<RunDeploymentPipelineJob>;
    await processDeploymentPipeline(fakeJob);

    const completedDeployment = await prisma.deployment.findUniqueOrThrow({ where: { id: deployment.id } });
    expect(completedDeployment.status).toBe("COMPLETED");
    expect(completedDeployment.healthStatus).toBe("HEALTHY");

    const completedJob = await prisma.deploymentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(completedJob.status).toBe("SUCCEEDED");

    const logs = await prisma.deploymentLog.findMany({ where: { deploymentId: deployment.id } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.message.includes("completed successfully"))).toBe(true);
    // Deployment logs must never contain anything that looks like a secret.
    expect(logs.every((l) => !/password|secret|private.?key/i.test(l.message))).toBe(true);

    const auditLogs = await prisma.auditLog.findMany({ where: { resourceId: deployment.id, resourceType: "Deployment" } });
    expect(auditLogs.some((a) => a.action === "deployment.started")).toBe(true);
    expect(auditLogs.some((a) => a.action === "deployment.completed")).toBe(true);

    // Order, application, version, deployment, and target are all linked --
    // the proof that Phase 2 and Phase 3 are wired together correctly.
    const fullDeployment = await prisma.deployment.findUniqueOrThrow({
      where: { id: deployment.id },
      include: { order: true, application: true, applicationVersion: true, deploymentTarget: true },
    });
    expect(fullDeployment.order?.id).toBe(order.id);
    expect(fullDeployment.application.id).toBe(applicationId);
    expect(fullDeployment.applicationVersion.version).toBe("1.0.0");
    expect(fullDeployment.deploymentTarget).not.toBeNull();
  }, 30000);
});
