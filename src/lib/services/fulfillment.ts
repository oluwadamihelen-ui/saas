import { prisma } from "@/lib/db";
import { getDomainProvider, getHostingProvider } from "@/lib/providers/registry";
import { createDeployment } from "@/lib/services/deployments";
import { logger } from "@/lib/security/logger";

interface FulfillmentIntent {
  deploymentType: "CUSTOMER_SERVER" | "PLATFORM_HOSTING" | "MANAGED";
  serverHost: string | null;
  serverPort: number | null;
  controlPanel: string | null;
  domainName: string | null;
  hostingPlanId: string | null;
}

/**
 * Runs after a payment is confirmed: provisions the hosting account/domain
 * the customer selected at checkout (via the relevant provider), creates the
 * DeploymentTarget the customer described, and enqueues the deployment
 * pipeline. Never runs inline with the payment webhook response -- only
 * kicks off the async work.
 */
export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  const intent = order.fulfillmentIntent as unknown as FulfillmentIntent | null;
  const licenseItem = order.items.find((i) => i.type === "APPLICATION_LICENSE" && i.applicationId);
  if (!intent || !licenseItem?.applicationId) {
    logger.warn("fulfillment.skipped_no_intent", { orderId });
    return;
  }

  let hostingAccountId: string | undefined;
  if (intent.deploymentType === "PLATFORM_HOSTING" && intent.hostingPlanId) {
    const plan = await prisma.hostingPlan.findUnique({ where: { id: intent.hostingPlanId } });
    if (plan) {
      const hostingProvider = await getHostingProvider();
      const account = await hostingProvider.createAccount({
        planCode: plan.providerPlanCode ?? plan.slug,
        customerEmail: order.billingEmail ?? "",
        domain: intent.domainName ?? `${order.orderNumber.toLowerCase()}.platform-hosting.example`,
      });
      const hostingAccount = await prisma.hostingAccount.create({
        data: {
          customerId: order.customerId,
          hostingPlanId: plan.id,
          provider: hostingProvider.key,
          providerAccountId: account.providerAccountId,
          status: account.status === "ACTIVE" ? "ACTIVE" : "PENDING",
          primaryDomain: intent.domainName,
        },
      });
      hostingAccountId = hostingAccount.id;
    }
  }

  let domainId: string | undefined;
  if (intent.domainName) {
    const domainProvider = await getDomainProvider();
    try {
      const available = await domainProvider.checkAvailability(intent.domainName);
      if (available) {
        const result = await domainProvider.registerDomain({
          domain: intent.domainName,
          years: 1,
          customerEmail: order.billingEmail ?? "",
          customerName: order.billingName ?? "",
        });
        const domain = await prisma.domain.create({
          data: {
            name: intent.domainName,
            tld: intent.domainName.split(".").slice(1).join("."),
            customerId: order.customerId,
            registrarProvider: domainProvider.key,
            providerRef: result.providerRef,
            status: "ACTIVE",
            registeredAt: new Date(result.registeredAt),
            expiresAt: new Date(result.expiresAt),
            nameservers: result.nameservers,
          },
        });
        domainId = domain.id;
      } else {
        logger.warn("fulfillment.domain_unavailable", { orderId, domain: intent.domainName });
      }
    } catch (error) {
      logger.error("fulfillment.domain_registration_failed", { orderId, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  // Build the DeploymentTarget the customer described at checkout. Left
  // unvalidated-but-recorded for CUSTOMER_SERVER (the pipeline's own
  // validateTarget step is what turns a bad hostname into
  // NEEDS_CUSTOMER_ACTION, not a hard failure here).
  let deploymentTargetId: string | undefined;
  if (intent.deploymentType === "CUSTOMER_SERVER") {
    const target = await prisma.deploymentTarget.create({
      data: {
        customerId: order.customerId,
        type: "CUSTOMER_SERVER",
        provider: "ssh",
        label: "Customer server (from checkout)",
        hostname: intent.serverHost ?? undefined,
        port: intent.serverPort ?? undefined,
        controlPanel: intent.controlPanel ?? undefined,
        domainId,
        status: "PENDING",
      },
    });
    deploymentTargetId = target.id;
  } else if (intent.deploymentType === "PLATFORM_HOSTING" && hostingAccountId) {
    const target = await prisma.deploymentTarget.create({
      data: {
        customerId: order.customerId,
        type: "PLATFORM_HOSTING",
        provider: "cloud",
        label: "Platform-managed hosting",
        hostingAccountId,
        domainId,
        status: "ACTIVE",
      },
    });
    deploymentTargetId = target.id;
  }

  await createDeployment({
    customerId: order.customerId,
    orderId: order.id,
    applicationId: licenseItem.applicationId,
    type: intent.deploymentType,
    domainId,
    hostingAccountId,
    deploymentTargetId,
  });

  await prisma.order.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
  logger.info("fulfillment.completed", { orderId });
}
