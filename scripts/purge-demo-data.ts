import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

// Every account prisma/seed/index.ts's demo tier (seedUsers, seedPhase7DemoData)
// ever creates. Anything reachable from these six accounts -- their orders,
// deployments, domains, hosting accounts, tickets, licenses, commissions,
// the marketplace applications they "authored" -- is demo data by
// construction, since nothing in this codebase creates data for these
// specific emails except the seed script. Kept in sync with seedUsers()/
// seedPhase7DemoData() in prisma/seed/index.ts.
const DEMO_EMAILS = [
  "admin@bridgecodes.example",
  "ops@bridgecodes.example",
  "sarah@brightretail.com",
  "david@northgaterealty.com",
  "grace@clinicly.example",
  "femi@devstudio.example",
];

const DEMO_COUPON_CODES = ["WELCOME10", "SAVE20", "EXPIRED5"];
const DEMO_BUNDLE_SLUG = "launch-pack";

// Every application prisma/seed/index.ts's demo tier creates (the 10
// APP_SEEDS entries plus the two seedPhase7DemoData listings), by their
// deterministic slugs. Matched in addition to createdById below rather
// than instead of it -- belt and suspenders in case createdById ever
// drifts (e.g. the seeded admin account was deleted and recreated with a
// new id at some point), since these slugs are as fixed as the emails
// above. Kept in sync with APP_SEEDS/seedPhase7DemoData in
// prisma/seed/index.ts.
const DEMO_APP_SLUGS = [
  "nimbus-crm",
  "brightclass-school-manager",
  "stockflow-inventory",
  "plateful-restaurant-pos",
  "stayeasy-booking-platform",
  "clinicly-hospital-manager",
  "pharmatrack",
  "northgate-realty-platform",
  "peopleops-hr-suite",
  "shopfront-e-commerce",
  "devstudio-helpdesk",
  "devstudio-analytics",
];

/**
 * Deletes every row prisma/seed/index.ts's demo tier ever created --
 * the six seeded accounts, the marketplace listings they authored, and
 * every order/deployment/domain/hosting/ticket/quote/coupon/bundle
 * reachable from them -- leaving only core reference data (roles,
 * permissions, the provider catalog, settings, categories, hosting
 * plans) and anything a real person created through the app themselves.
 *
 * Deletion order matters: most children cascade at the database level
 * from their immediate parent (Application -> versions/images/features/
 * pricing/reviews, Order -> OrderItem, Bundle -> BundleItem, Quote ->
 * QuoteItem, SupportTicket -> SupportMessage, Domain -> DNSRecord,
 * DeploymentTarget -> DeploymentCredential, Deployment -> logs/jobs), so
 * this only needs to delete cascade *roots* explicitly. Everything else
 * below has no cascade and has to be deleted in dependency order by
 * hand -- e.g. Commission references a specific OrderItem, so it has to
 * go before the Order it belongs to; Quote/CustomizationRequest have to
 * go before the Order a quote may have converted into.
 *
 * Idempotent -- running it again when there's nothing left to purge is a
 * no-op. Safe to run against a database that also has real users/orders:
 * every query below is scoped to the six demo accounts (or, for the
 * catalog-level coupons/bundle, their exact seeded codes/slug) and never
 * touches anything else.
 */
async function main() {
  const demoUsers = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } }, select: { id: true, email: true } });
  const demoUserIds = demoUsers.map((u) => u.id);
  // Not an early-exit on an empty result -- demo applications are also
  // matched by slug (below), independent of whether their creator account
  // still exists, so there can be real work to do here even when none of
  // DEMO_EMAILS currently has an account.
  console.log(demoUserIds.length > 0 ? `Found ${demoUserIds.length} demo account(s): ${demoUsers.map((u) => u.email).join(", ")}` : "No demo accounts found by email -- still checking for demo applications by slug.");

  const demoApps = await prisma.application.findMany({
    where: { OR: [{ createdById: { in: demoUserIds } }, { slug: { in: DEMO_APP_SLUGS } }] },
    select: { id: true, name: true },
  });
  const demoAppIds = demoApps.map((a) => a.id);

  const demoOrders = await prisma.order.findMany({ where: { customerId: { in: demoUserIds } }, select: { id: true } });
  const orderIds = demoOrders.map((o) => o.id);

  const demoHostingAccounts = await prisma.hostingAccount.findMany({ where: { customerId: { in: demoUserIds } }, select: { id: true } });
  const hostingAccountIds = demoHostingAccounts.map((h) => h.id);

  const demoDomains = await prisma.domain.findMany({ where: { customerId: { in: demoUserIds } }, select: { id: true } });
  const domainIds = demoDomains.map((d) => d.id);

  const demoDeployments = await prisma.deployment.findMany({
    where: { OR: [{ customerId: { in: demoUserIds } }, { orderId: { in: orderIds } }, { applicationId: { in: demoAppIds } }] },
    select: { id: true },
  });
  const deploymentIds = demoDeployments.map((d) => d.id);

  const demoTargets = await prisma.deploymentTarget.findMany({ where: { customerId: { in: demoUserIds } }, select: { id: true } });
  const deploymentTargetIds = demoTargets.map((t) => t.id);

  // Requests/quotes reference an Application and can reference each other
  // (CustomizationRequest.quoteId -> Quote) -- both go before Order, since
  // an accepted quote can carry a orderId pointing at one.
  await prisma.customizationRequest.deleteMany({ where: { OR: [{ customerId: { in: demoUserIds } }, { applicationId: { in: demoAppIds } }] } });
  await prisma.quote.deleteMany({ where: { customerId: { in: demoUserIds } } }); // cascades QuoteItem

  // Commission references a specific OrderItem (unique FK) -- must go
  // before that OrderItem's Order is deleted.
  await prisma.commission.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { developerId: { in: demoUserIds } }, { applicationId: { in: demoAppIds } }] } });

  await prisma.applicationLicense.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { customerId: { in: demoUserIds } }, { applicationId: { in: demoAppIds } }] } });

  await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } }); // cascades InvoiceItem
  await prisma.refund.deleteMany({ where: { payment: { orderId: { in: orderIds } } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });

  await prisma.deploymentLog.deleteMany({ where: { deploymentId: { in: deploymentIds } } });
  await prisma.deploymentJob.deleteMany({ where: { deploymentId: { in: deploymentIds } } });
  await prisma.deployment.deleteMany({ where: { id: { in: deploymentIds } } });

  await prisma.deploymentCredential.deleteMany({ where: { deploymentTargetId: { in: deploymentTargetIds } } });
  await prisma.deploymentTarget.deleteMany({ where: { id: { in: deploymentTargetIds } } });

  await prisma.subscription.deleteMany({ where: { OR: [{ customerId: { in: demoUserIds } }, { referenceId: { in: hostingAccountIds } }] } });
  await prisma.hostingAccount.deleteMany({ where: { id: { in: hostingAccountIds } } });

  await prisma.domainOrder.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { domainId: { in: domainIds } }] } });
  await prisma.domain.deleteMany({ where: { id: { in: domainIds } } }); // cascades DNSRecord

  // Order last among order-graph deletes -- everything above that
  // references an orderId is now gone, and cascades OrderItem itself.
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

  // Bundle/Coupon depend on Order's OrderItem rows (bundleId/couponId)
  // being gone, which just happened via Order's cascade.
  await prisma.bundle.deleteMany({ where: { slug: DEMO_BUNDLE_SLUG } }); // cascades BundleItem
  await prisma.coupon.deleteMany({ where: { code: { in: DEMO_COUPON_CODES } } });

  // A demo staff account may have authored a message on a ticket that
  // doesn't belong to a demo customer -- delete by author too, not just
  // by ticket ownership, before the ticket cascade and before the users.
  await prisma.supportMessage.deleteMany({ where: { authorId: { in: demoUserIds } } });
  await prisma.supportTicket.deleteMany({ where: { customerId: { in: demoUserIds } } }); // cascades remaining SupportMessage

  await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: demoUserIds } } });

  // Application last of the catalog data -- every row that referenced it
  // (Commission, ApplicationLicense, CustomizationRequest, BundleItem,
  // OrderItem) is gone by now; this cascades images/features/reviews/
  // pricing/versions(+their artifact and deployment spec).
  await prisma.application.deleteMany({ where: { id: { in: demoAppIds } } });

  await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });

  console.log(`Purged ${demoUserIds.length} demo account(s), ${demoAppIds.length} demo application(s), ${orderIds.length} demo order(s).`);
  console.log("Core reference data (roles, permissions, providers, settings, categories, hosting plans) was left untouched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
