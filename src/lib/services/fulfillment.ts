import { prisma } from "@/lib/db";
import { getDomainProvider, getHostingProvider } from "@/lib/providers/registry";
import { createDeployment } from "@/lib/services/deployments";
import { notifyUser } from "@/lib/services/notifications";
import { processQuoteOrder } from "@/lib/services/quotes";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

interface FulfillmentIntent {
  deploymentType: "CUSTOMER_SERVER" | "PLATFORM_HOSTING" | "MANAGED";
  serverHost: string | null;
  serverPort: number | null;
  controlPanel: string | null;
  domainName: string | null;
  hostingPlanId: string | null;
}

interface DomainOrderResult {
  domainOrderId: string;
  domainName: string;
  status: "COMPLETED" | "FAILED";
  domainId?: string;
}

/**
 * Processes every still-pending DomainOrder row attached to a paid order --
 * registering or renewing the underlying domain via the registrar adapter
 * and updating the ledger. Runs for every order (not just ones with an
 * application license) since a domain-only purchase/renewal is a valid order
 * on its own, and always before the license/deployment logic below so a
 * combined "app + domain" order has its domain ready when the deployment
 * target is built.
 */
async function processDomainOrders(orderId: string, customerId: string): Promise<DomainOrderResult[]> {
  const pending = await prisma.domainOrder.findMany({ where: { orderId, status: "PENDING" }, include: { domain: true } });
  if (pending.length === 0) return [];

  const domainProvider = await getDomainProvider();
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
  const results: DomainOrderResult[] = [];

  for (const domainOrder of pending) {
    try {
      if (domainOrder.action === "REGISTER") {
        const available = await domainProvider.checkAvailability(domainOrder.domainName);
        if (!available) throw new Error(`${domainOrder.domainName} is no longer available`);

        const result = await domainProvider.registerDomain({
          domain: domainOrder.domainName,
          years: domainOrder.years,
          customerEmail: customer.email,
          customerName: customer.name ?? customer.email,
          registrantAddress1: customer.addressLine1 ?? undefined,
          registrantCity: customer.city ?? undefined,
          registrantStateProvince: customer.stateProvince ?? undefined,
          registrantPostalCode: customer.postalCode ?? undefined,
          registrantCountry: customer.country ?? undefined,
          registrantPhone: customer.phone ?? undefined,
        });
        const domain = await prisma.domain.create({
          data: {
            name: domainOrder.domainName,
            tld: domainOrder.domainName.split(".").slice(1).join("."),
            customerId,
            registrarProvider: domainProvider.key,
            providerRef: result.providerRef,
            status: "ACTIVE",
            registeredAt: new Date(result.registeredAt),
            expiresAt: new Date(result.expiresAt),
            nameservers: result.nameservers,
          },
        });
        await prisma.domainOrder.update({ where: { id: domainOrder.id }, data: { status: "COMPLETED", domainId: domain.id } });
        await recordAuditLog({ actorId: customerId, action: "domain.registered", resourceType: "Domain", resourceId: domain.id, newValue: { name: domain.name, years: domainOrder.years } });
        await notifyUser(customerId, { type: "domain.registered", title: "Domain registered", message: `${domain.name} has been registered and is ready to use.` });
        results.push({ domainOrderId: domainOrder.id, domainName: domainOrder.domainName, status: "COMPLETED", domainId: domain.id });
      } else if (domainOrder.action === "RENEW") {
        if (!domainOrder.domain) throw new Error("Renewal order has no linked domain");
        const { expiresAt } = await domainProvider.renewDomain(domainOrder.domain.name, domainOrder.years, domainOrder.domain.expiresAt?.toISOString());
        await prisma.domain.update({ where: { id: domainOrder.domain.id }, data: { status: "ACTIVE", expiresAt: new Date(expiresAt) } });
        await prisma.domainOrder.update({ where: { id: domainOrder.id }, data: { status: "COMPLETED" } });
        await recordAuditLog({ actorId: customerId, action: "domain.renewed", resourceType: "Domain", resourceId: domainOrder.domain.id, newValue: { years: domainOrder.years, expiresAt } });
        await notifyUser(customerId, { type: "domain.renewed", title: "Domain renewed", message: `${domainOrder.domain.name} has been renewed through ${new Date(expiresAt).toDateString()}.` });
        results.push({ domainOrderId: domainOrder.id, domainName: domainOrder.domainName, status: "COMPLETED", domainId: domainOrder.domain.id });
      } else {
        // TRANSFER is modeled but not yet a purchasable flow -- nothing enqueues one today.
        continue;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      await prisma.domainOrder.update({ where: { id: domainOrder.id }, data: { status: "FAILED" } });
      await notifyUser(customerId, {
        type: "domain.order_failed",
        title: `Domain ${domainOrder.action === "REGISTER" ? "registration" : "renewal"} failed`,
        message: `We couldn't complete this for ${domainOrder.domainName}: ${message}. Please contact support.`,
      });
      logger.error("fulfillment.domain_order_failed", { orderId, domainOrderId: domainOrder.id, error: message });
      results.push({ domainOrderId: domainOrder.id, domainName: domainOrder.domainName, status: "FAILED" });
    }
  }

  return results;
}

/**
 * Runs after a payment is confirmed: processes any domain order (register or
 * renew), provisions the hosting account the customer selected at checkout,
 * creates the DeploymentTarget the customer described, and enqueues the
 * deployment pipeline. Never runs inline with the payment webhook response --
 * only kicks off the async work.
 */
export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  const domainOrderResults = await processDomainOrders(order.id, order.customerId);
  await processQuoteOrder(order.id);

  const intent = order.fulfillmentIntent as unknown as FulfillmentIntent | null;
  const licenseItem = order.items.find((i) => i.type === "APPLICATION_LICENSE" && i.applicationId);
  if (!intent || !licenseItem?.applicationId) {
    logger.warn("fulfillment.skipped_no_intent", { orderId, domainOrdersProcessed: domainOrderResults.length });
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

      // Hosting bills monthly for as long as the account is active -- this
      // Subscription row is what the renewal scheduler (runHostingRenewalSweep)
      // finds and charges each cycle. Without it, hosting would only ever be
      // billed once, at this initial purchase.
      if (hostingAccount.status === "ACTIVE") {
        const periodStart = new Date();
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await prisma.subscription.create({
          data: {
            customerId: order.customerId,
            type: "HOSTING",
            referenceId: hostingAccount.id,
            status: "ACTIVE",
            amount: plan.priceMonthly,
            currency: order.currency,
            billingCycle: "MONTHLY",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
          },
        });
      }
    }
  }

  const domainId = intent.domainName
    ? domainOrderResults.find((r) => r.domainName === intent.domainName && r.status === "COMPLETED")?.domainId
    : undefined;

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
