import "server-only";
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
 * the customer selected at checkout (via the relevant provider) and enqueues
 * the deployment pipeline. Never runs inline with the payment webhook
 * response -- only kicks off the async work.
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

  await createDeployment({
    customerId: order.customerId,
    orderId: order.id,
    applicationId: licenseItem.applicationId,
    type: intent.deploymentType,
    domainId,
    hostingAccountId,
    adapter: intent.deploymentType === "CUSTOMER_SERVER" ? "ssh" : "cloud",
    serverConfig:
      intent.deploymentType === "CUSTOMER_SERVER"
        ? { host: intent.serverHost, port: intent.serverPort, controlPanel: intent.controlPanel }
        : undefined,
  });

  await prisma.order.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
  logger.info("fulfillment.completed", { orderId });
}
