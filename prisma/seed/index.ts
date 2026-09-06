import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS } from "../../src/lib/auth/permissions";

const prisma = new PrismaClient();

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function placeholderImage(seed: string, i: number) {
  return `https://picsum.photos/seed/${seed}-${i}/900/560`;
}

async function seedRolesAndPermissions() {
  const permissionRecords = await Promise.all(
    PERMISSION_CATALOG.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: { description: p.description, category: p.category },
        create: { key: p.key, description: p.description, category: p.category },
      })
    )
  );
  const permissionByKey = new Map(permissionRecords.map((p) => [p.key, p]));

  const roleDefs: { key: "SUPER_ADMIN" | "STAFF" | "CUSTOMER" | "DEVELOPER"; name: string; description: string }[] = [
    { key: "SUPER_ADMIN", name: "Super Admin", description: "Full control over the platform" },
    { key: "STAFF", name: "Staff / Operations", description: "Limited administrative access" },
    { key: "CUSTOMER", name: "Customer", description: "Buys and manages applications, deployments and services" },
    { key: "DEVELOPER", name: "App Developer", description: "Future role: publishes applications to the marketplace" },
  ];

  const roles = new Map<string, { id: string }>();
  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      update: { name: def.name, description: def.description },
      create: { key: def.key, name: def.name, description: def.description },
    });
    roles.set(def.key, role);

    const grantKeys = ROLE_DEFAULT_PERMISSIONS[def.key];
    for (const key of grantKeys) {
      const permission = permissionByKey.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  return roles;
}

async function seedProviders() {
  const providers: { name: string; type: "PAYMENT" | "DOMAIN" | "DNS" | "HOSTING" | "DEPLOYMENT" | "EMAIL"; adapterKey: string; isDefault: boolean }[] = [
    { name: "Mock Payments", type: "PAYMENT", adapterKey: "mock", isDefault: true },
    { name: "Paystack", type: "PAYMENT", adapterKey: "paystack", isDefault: false },
    { name: "Mock Registrar", type: "DOMAIN", adapterKey: "mock", isDefault: true },
    { name: "Mock DNS", type: "DNS", adapterKey: "mock", isDefault: true },
    { name: "Mock Hosting", type: "HOSTING", adapterKey: "mock", isDefault: true },
    { name: "Mock Deployment", type: "DEPLOYMENT", adapterKey: "mock", isDefault: true },
    { name: "Mock Email", type: "EMAIL", adapterKey: "mock", isDefault: true },
  ];

  for (const p of providers) {
    const existing = await prisma.provider.findFirst({ where: { type: p.type, adapterKey: p.adapterKey } });
    if (existing) continue;
    await prisma.provider.create({
      data: { name: p.name, type: p.type, adapterKey: p.adapterKey, isDefault: p.isDefault, mode: p.adapterKey === "mock" ? "MOCK" : "ERROR" },
    });
  }
}

async function seedSettings() {
  await prisma.setting.upsert({
    where: { key: "general" },
    update: {},
    create: { key: "general", value: { companyName: "BridgeCodes, Inc.", supportEmail: "support@bridgecodes.example", currency: "USD" } },
  });

  await prisma.notificationSchedule.upsert({
    where: { key: "domain.expiry" },
    update: {},
    create: { key: "domain.expiry", daysBefore: [30, 14, 7, 3, 1], isActive: true },
  });

  const legalDocs = [
    { slug: "terms", title: "Terms of Service", body: "These Terms of Service govern your use of BridgeCodes's marketplace and managed deployment services. By purchasing or deploying an application through the platform, you agree to these terms.\n\nBridgeCodes acts as an orchestration layer connecting you to third-party domain, hosting, and payment providers. Specific provider terms may apply in addition to these terms." },
    { slug: "privacy", title: "Privacy Policy", body: "BridgeCodes collects the information necessary to provide our marketplace, deployment, and hosting services, including account details, billing information, and deployment configuration.\n\nWe do not sell your personal data. Information is shared with third-party providers (domain registrars, hosting providers, payment processors) only as required to fulfill your order." },
    { slug: "refunds", title: "Refund Policy", body: "Software licenses may be refunded within 14 days of purchase if no deployment has been completed. Installation and customization services are non-refundable once work has begun. Domain registrations are non-refundable once registered with the registry." },
    { slug: "acceptable-use", title: "Acceptable Use Policy", body: "You may not use applications or infrastructure obtained through BridgeCodes for unlawful purposes, to distribute malware, or to violate the acceptable use policies of our underlying domain, hosting, or payment providers." },
  ];

  for (const doc of legalDocs) {
    await prisma.setting.upsert({
      where: { key: `legal.${doc.slug}` },
      update: {},
      create: { key: `legal.${doc.slug}`, value: { title: doc.title, body: doc.body } },
    });
  }
}

async function seedCategories() {
  const categories = [
    { name: "Business Management", description: "CRM, HR, and internal operations tools" },
    { name: "Hospitality", description: "Restaurant, hotel, and booking platforms" },
    { name: "Healthcare", description: "Hospital and clinic management systems" },
    { name: "Real Estate", description: "Property listing and management platforms" },
    { name: "E-Commerce", description: "Online storefronts and inventory tools" },
  ];

  const records = [];
  for (const [i, c] of categories.entries()) {
    const record = await prisma.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description, sortOrder: i },
    });
    records.push(record);
  }
  return records;
}

interface AppSeed {
  name: string;
  categoryIndex: number;
  shortDescription: string;
  fullDescription: string;
  technologyStack: string[];
  licensePrice: number;
  installationPrice: number;
  customizationPrice: number;
  maintenancePrice: number;
  runtime: string;
  databaseType: string;
  featured: boolean;
}

const APP_SEEDS: AppSeed[] = [
  {
    name: "Nimbus CRM",
    categoryIndex: 0,
    shortDescription: "A modern CRM to manage leads, deals, and customer relationships.",
    fullDescription: "Nimbus CRM gives sales teams a single place to track leads, manage pipelines, and close deals faster. Includes contact management, deal tracking, email templates, and reporting dashboards built for small and mid-sized businesses.",
    technologyStack: ["Next.js", "PostgreSQL", "Tailwind CSS"],
    licensePrice: 299,
    installationPrice: 99,
    customizationPrice: 199,
    maintenancePrice: 39,
    runtime: "node20",
    databaseType: "postgresql",
    featured: true,
  },
  {
    name: "Brightclass School Manager",
    categoryIndex: 0,
    shortDescription: "Complete school management system for admissions, grading, and fees.",
    fullDescription: "Brightclass helps schools manage student admissions, attendance, grading, timetables, and fee collection in one platform, with parent and teacher portals included.",
    technologyStack: ["Next.js", "PostgreSQL", "Redis"],
    licensePrice: 449,
    installationPrice: 149,
    customizationPrice: 299,
    maintenancePrice: 49,
    runtime: "node20",
    databaseType: "postgresql",
    featured: true,
  },
  {
    name: "StockFlow Inventory",
    categoryIndex: 0,
    shortDescription: "Inventory and warehouse management with barcode support.",
    fullDescription: "StockFlow tracks stock levels across multiple warehouses, supports barcode scanning, purchase orders, and low-stock alerts for retail and distribution businesses.",
    technologyStack: ["Next.js", "PostgreSQL"],
    licensePrice: 349,
    installationPrice: 99,
    customizationPrice: 199,
    maintenancePrice: 39,
    runtime: "node20",
    databaseType: "postgresql",
    featured: false,
  },
  {
    name: "Plateful Restaurant POS",
    categoryIndex: 1,
    shortDescription: "Restaurant ordering, table management, and point-of-sale system.",
    fullDescription: "Plateful covers dine-in table management, order tracking, kitchen display integration, and point-of-sale checkout designed for restaurants and cafes.",
    technologyStack: ["Next.js", "PostgreSQL", "Redis"],
    licensePrice: 399,
    installationPrice: 129,
    customizationPrice: 249,
    maintenancePrice: 45,
    runtime: "node20",
    databaseType: "postgresql",
    featured: true,
  },
  {
    name: "StayEasy Booking Platform",
    categoryIndex: 1,
    shortDescription: "Booking and reservation platform for hotels and short-let apartments.",
    fullDescription: "StayEasy lets hospitality businesses manage room inventory, availability calendars, guest bookings, and payments through a single booking engine.",
    technologyStack: ["Next.js", "PostgreSQL"],
    licensePrice: 379,
    installationPrice: 119,
    customizationPrice: 229,
    maintenancePrice: 42,
    runtime: "node20",
    databaseType: "postgresql",
    featured: false,
  },
  {
    name: "Clinicly Hospital Manager",
    categoryIndex: 2,
    shortDescription: "Hospital and clinic management for patients, appointments, and billing.",
    fullDescription: "Clinicly manages patient records, appointment scheduling, doctor rosters, and billing for clinics and small hospitals, with role-based access for staff.",
    technologyStack: ["Next.js", "PostgreSQL", "Redis"],
    licensePrice: 599,
    installationPrice: 199,
    customizationPrice: 349,
    maintenancePrice: 59,
    runtime: "node20",
    databaseType: "postgresql",
    featured: true,
  },
  {
    name: "PharmaTrack",
    categoryIndex: 2,
    shortDescription: "Pharmacy inventory and prescription tracking system.",
    fullDescription: "PharmaTrack helps pharmacies manage drug inventory, expiry tracking, and prescription records with automated low-stock and expiry alerts.",
    technologyStack: ["Next.js", "PostgreSQL"],
    licensePrice: 329,
    installationPrice: 99,
    customizationPrice: 199,
    maintenancePrice: 39,
    runtime: "node20",
    databaseType: "postgresql",
    featured: false,
  },
  {
    name: "Northgate Realty Platform",
    categoryIndex: 3,
    shortDescription: "Property listing and management platform for real estate agencies.",
    fullDescription: "Northgate lets real estate agencies list properties, manage inquiries, track viewings, and manage landlord/tenant relationships from a single dashboard.",
    technologyStack: ["Next.js", "PostgreSQL"],
    licensePrice: 499,
    installationPrice: 149,
    customizationPrice: 299,
    maintenancePrice: 49,
    runtime: "node20",
    databaseType: "postgresql",
    featured: true,
  },
  {
    name: "PeopleOps HR Suite",
    categoryIndex: 0,
    shortDescription: "HR software for employee records, leave, and payroll basics.",
    fullDescription: "PeopleOps centralizes employee records, leave requests, and basic payroll calculations, with manager approval workflows and reporting.",
    technologyStack: ["Next.js", "PostgreSQL"],
    licensePrice: 429,
    installationPrice: 129,
    customizationPrice: 249,
    maintenancePrice: 45,
    runtime: "node20",
    databaseType: "postgresql",
    featured: false,
  },
  {
    name: "ShopFront E-Commerce",
    categoryIndex: 4,
    shortDescription: "Full-featured online store with catalog, cart, and checkout.",
    fullDescription: "ShopFront is a ready-to-launch e-commerce storefront with product catalog management, cart, checkout, order tracking, and admin dashboard.",
    technologyStack: ["Next.js", "PostgreSQL", "Redis"],
    licensePrice: 549,
    installationPrice: 179,
    customizationPrice: 329,
    maintenancePrice: 55,
    runtime: "node20",
    databaseType: "postgresql",
    featured: true,
  },
];

async function seedApplications(categories: { id: string }[], adminId: string) {
  const apps = [];
  for (const seed of APP_SEEDS) {
    const slug = slugify(seed.name);
    const category = categories[seed.categoryIndex];

    const app = await prisma.application.upsert({
      where: { slug },
      update: {},
      create: {
        name: seed.name,
        slug,
        categoryId: category.id,
        shortDescription: seed.shortDescription,
        fullDescription: seed.fullDescription,
        technologyStack: seed.technologyStack,
        currentVersion: "1.0.0",
        status: "PUBLISHED",
        featured: seed.featured,
        demoUrl: `https://demo.bridgecodes.example/${slug}`,
        demoUsername: "demo",
        demoPassword: "demo1234",
        whatsIncluded: ["Full source deployment", "Admin dashboard", "Email notifications"],
        whatsNotIncluded: ["Custom branding beyond logo swap", "Third-party integrations not listed"],
        requirements: ["A domain (or use our hosting)", "SMTP or email provider for notifications"],
        seoTitle: `${seed.name} — Ready-to-Deploy Application`,
        seoDescription: seed.shortDescription,
        createdById: adminId,
        images: { create: [1, 2, 3].map((i) => ({ url: placeholderImage(slug, i), sortOrder: i })) },
        features: {
          create: [
            { title: "Role-based access", description: "Separate permissions for admins, staff, and end users.", sortOrder: 0 },
            { title: "Responsive dashboard", description: "Works on desktop, tablet, and mobile.", sortOrder: 1 },
            { title: "Email notifications", description: "Automated notifications for key events.", sortOrder: 2 },
          ],
        },
        pricing: {
          create: [
            { type: "LICENSE", name: "Software License", amount: seed.licensePrice, billingCycle: "ONE_TIME", sortOrder: 0 },
            { type: "INSTALLATION", name: "Installation", amount: seed.installationPrice, billingCycle: "ONE_TIME", sortOrder: 1 },
            { type: "CUSTOMIZATION", name: "Customization", amount: seed.customizationPrice, billingCycle: "ONE_TIME", isStartingFrom: true, sortOrder: 2 },
            { type: "MAINTENANCE", name: "Maintenance Plan", amount: seed.maintenancePrice, billingCycle: "MONTHLY", sortOrder: 3 },
          ],
        },
        reviews: {
          create: [
            { customerName: "Tunde A.", rating: 5, comment: "Deployed in a day, works great." },
            { customerName: "Maria S.", rating: 4, comment: "Solid product, support was responsive." },
          ],
        },
      },
    });

    // Idempotent: on a re-seed of an app that already exists, ensure it
    // still has a published, isLatest version with a deployment
    // specification instead of silently leaving it without one.
    const hasLatestVersion = await prisma.applicationVersion.findFirst({ where: { applicationId: app.id, isLatest: true } });
    if (!hasLatestVersion) {
      const existingV1 = await prisma.applicationVersion.findFirst({ where: { applicationId: app.id, version: "1.0.0" } });
      const specData = {
        runtime: seed.runtime,
        databaseType: seed.databaseType,
        buildCommand: "npm run build",
        startCommand: "npm start",
        healthCheckPath: "/api/health",
        requiredServices: [seed.databaseType, "redis"].filter(Boolean),
        environmentVariables: [
          { key: "DATABASE_URL", description: "PostgreSQL connection string", required: true, secret: true },
          { key: "JWT_SECRET", description: "Secret used to sign auth tokens", required: true, secret: true },
          { key: "NEXT_PUBLIC_APP_URL", description: "Public URL of the deployed application", required: true, secret: false, defaultValue: `https://demo.bridgecodes.example/${slug}` },
        ],
      };

      if (existingV1) {
        await prisma.applicationVersion.update({
          where: { id: existingV1.id },
          data: {
            status: "STABLE",
            isLatest: true,
            isStable: true,
            deploymentSpecification: existingV1.deploymentSpecificationId
              ? { update: specData }
              : { create: specData },
            artifact: {
              upsert: {
                create: { type: "GIT_REPOSITORY", reference: `https://github.com/bridgecodes-apps/${slug}` },
                update: {},
              },
            },
          },
        });
      } else {
        await prisma.applicationVersion.create({
          data: {
            application: { connect: { id: app.id } },
            version: "1.0.0",
            releaseName: "Initial release",
            status: "STABLE",
            isLatest: true,
            isStable: true,
            deploymentSpecification: { create: specData },
            artifact: { create: { type: "GIT_REPOSITORY", reference: `https://github.com/bridgecodes-apps/${slug}` } },
          },
        });
      }
    }

    apps.push(app);
  }
  return apps;
}

async function seedHostingPlans() {
  const plans = [
    { name: "Starter", slug: "starter", description: "For a single application getting started.", websitesLimit: 1, storageGB: 10, bandwidthGB: 100, databasesLimit: 1, priceMonthly: 12, priceYearly: 120, sortOrder: 0 },
    { name: "Business", slug: "business", description: "For growing businesses running multiple sites.", websitesLimit: 5, storageGB: 50, bandwidthGB: 500, databasesLimit: 5, priceMonthly: 35, priceYearly: 350, sortOrder: 1 },
    { name: "Enterprise", slug: "enterprise", description: "Custom infrastructure for high-traffic deployments.", websitesLimit: 999, storageGB: 500, bandwidthGB: 5000, databasesLimit: 999, priceMonthly: 0, isCustom: true, sortOrder: 2 },
  ];

  const records = [];
  for (const plan of plans) {
    const record = await prisma.hostingPlan.upsert({ where: { slug: plan.slug }, update: {}, create: plan });
    records.push(record);
  }
  return records;
}

async function seedUsers(roles: Map<string, { id: string }>) {
  const passwordHash = await bcrypt.hash("Passw0rd!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bridgecodes.example" },
    update: {},
    create: { name: "Ada Admin", email: "admin@bridgecodes.example", passwordHash, roleId: roles.get("SUPER_ADMIN")!.id, status: "ACTIVE" },
  });

  const staff = await prisma.user.upsert({
    where: { email: "ops@bridgecodes.example" },
    update: {},
    create: { name: "Ops Ola", email: "ops@bridgecodes.example", passwordHash, roleId: roles.get("STAFF")!.id, status: "ACTIVE" },
  });

  const customerDefs = [
    { name: "Sarah Bright", email: "sarah@brightretail.com", company: "Bright Retail Ltd." },
    { name: "David Chen", email: "david@northgaterealty.com", company: "Northgate Realty" },
    { name: "Grace Adeyemi", email: "grace@clinicly.example", company: "Clinicly Health Group" },
  ];

  const customers = [];
  for (const c of customerDefs) {
    const customer = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { name: c.name, email: c.email, company: c.company, passwordHash, roleId: roles.get("CUSTOMER")!.id, status: "ACTIVE", country: "Nigeria" },
    });
    customers.push(customer);
  }

  return { admin, staff, customers };
}

function orderNumber(i: number) {
  return `ORD-2601-${String(100 + i).padStart(6, "0")}`;
}

// Seed data is meant to be re-runnable during development. Rather than
// upserting every deep relation individually, clear out the previous
// seed-generated demo scenario (identified by its deterministic prefixes)
// before recreating it -- catalog data (apps, categories, plans) stays
// untouched via upsert elsewhere in this script.
async function clearSeededOrderScenarios() {
  const staleOrders = await prisma.order.findMany({ where: { orderNumber: { startsWith: "ORD-2601-" } }, select: { id: true } });
  const staleOrderIds = staleOrders.map((o) => o.id);
  if (staleOrderIds.length === 0) return;

  const staleDeployments = await prisma.deployment.findMany({ where: { orderId: { in: staleOrderIds } }, select: { id: true, deploymentTargetId: true } });
  const staleDeploymentIds = staleDeployments.map((d) => d.id);
  const staleTargetIds = staleDeployments.map((d) => d.deploymentTargetId).filter((id): id is string => Boolean(id));

  await prisma.deploymentLog.deleteMany({ where: { deploymentId: { in: staleDeploymentIds } } });
  await prisma.deploymentJob.deleteMany({ where: { deploymentId: { in: staleDeploymentIds } } });
  await prisma.deployment.deleteMany({ where: { id: { in: staleDeploymentIds } } });
  await prisma.deploymentCredential.deleteMany({ where: { deploymentTargetId: { in: staleTargetIds } } });
  await prisma.deploymentTarget.deleteMany({ where: { id: { in: staleTargetIds } } });
  await prisma.applicationLicense.deleteMany({ where: { orderId: { in: staleOrderIds } } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: staleOrderIds } } } });
  await prisma.invoice.deleteMany({ where: { orderId: { in: staleOrderIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: staleOrderIds } } });
  const staleHostingAccounts = await prisma.hostingAccount.findMany({ where: { providerAccountId: { startsWith: "mock_hosting_seed_" } }, select: { id: true } });
  await prisma.subscription.deleteMany({ where: { referenceId: { in: staleHostingAccounts.map((h) => h.id) } } });
  await prisma.hostingAccount.deleteMany({ where: { id: { in: staleHostingAccounts.map((h) => h.id) } } });
  await prisma.domain.deleteMany({ where: { providerRef: { startsWith: "mock_domain_seed_" } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: staleOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: staleOrderIds } } });
}

async function seedOrdersAndDeployments(
  customers: { id: string; name: string; email: string }[],
  apps: { id: string; name: string; slug: string }[],
  hostingPlans: { id: string; name: string; priceMonthly: unknown }[]
) {
  await clearSeededOrderScenarios();

  const scenarios: {
    customerIndex: number;
    appIndex: number;
    deploymentStatus: "COMPLETED" | "INSTALLING" | "FAILED" | "QUEUED";
    deploymentType: "MANAGED" | "PLATFORM_HOSTING" | "CUSTOMER_SERVER";
    withHosting: boolean;
    withDomain: boolean;
  }[] = [
    { customerIndex: 0, appIndex: 3, deploymentStatus: "COMPLETED", deploymentType: "PLATFORM_HOSTING", withHosting: true, withDomain: true },
    { customerIndex: 0, appIndex: 0, deploymentStatus: "INSTALLING", deploymentType: "MANAGED", withHosting: false, withDomain: false },
    { customerIndex: 1, appIndex: 7, deploymentStatus: "COMPLETED", deploymentType: "PLATFORM_HOSTING", withHosting: true, withDomain: true },
    { customerIndex: 2, appIndex: 5, deploymentStatus: "FAILED", deploymentType: "CUSTOMER_SERVER", withHosting: false, withDomain: false },
    { customerIndex: 2, appIndex: 9, deploymentStatus: "QUEUED", deploymentType: "PLATFORM_HOSTING", withHosting: true, withDomain: false },
  ];

  let i = 0;
  for (const scenario of scenarios) {
    i += 1;
    const customer = customers[scenario.customerIndex];
    const app = apps[scenario.appIndex];
    const appPricing = await prisma.applicationPricing.findFirst({ where: { applicationId: app.id, type: "LICENSE" } });
    const version = await prisma.applicationVersion.findFirstOrThrow({ where: { applicationId: app.id, isLatest: true } });
    const licenseAmount = Number(appPricing?.amount ?? 299);
    const hostingPlan = scenario.withHosting ? hostingPlans[0] : null;
    const hostingAmount = hostingPlan ? Number(hostingPlan.priceMonthly) : 0;
    const subtotal = licenseAmount + hostingAmount;

    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumber(i),
        customerId: customer.id,
        status: scenario.deploymentStatus === "COMPLETED" ? "COMPLETED" : scenario.deploymentStatus === "FAILED" ? "AWAITING_CUSTOMER" : "IN_PROGRESS",
        paymentStatus: "PAID",
        paymentProvider: "mock",
        transactionRef: `mock_seed_${i}`,
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        billingName: customer.name,
        billingEmail: customer.email,
        items: {
          create: [
            { type: "APPLICATION_LICENSE", applicationId: app.id, applicationPricingId: appPricing?.id, description: `${app.name} — Software License`, quantity: 1, unitPrice: licenseAmount, total: licenseAmount },
            ...(hostingPlan
              ? [{ type: "HOSTING_PLAN" as const, hostingPlanId: hostingPlan.id, description: `${hostingPlan.name} Hosting`, billingCycle: "MONTHLY" as const, quantity: 1, unitPrice: hostingAmount, total: hostingAmount }]
              : []),
          ],
        },
      },
      include: { items: true },
    });

    await prisma.payment.create({
      data: { orderId: order.id, provider: "mock", providerRef: order.transactionRef!, amount: subtotal, currency: "USD", status: "PAID" },
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-2026-${String(1000 + i)}`,
        orderId: order.id,
        customerId: customer.id,
        status: "PAID",
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        paidAt: new Date(),
        items: { create: order.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })) },
      },
    });

    await prisma.applicationLicense.create({
      data: { licenseKey: `SEED-${i}-${app.slug.toUpperCase().slice(0, 6)}`, customerId: customer.id, applicationId: app.id, orderId: order.id, status: "ACTIVE" },
    });

    let hostingAccountId: string | undefined;
    if (hostingPlan) {
      const account = await prisma.hostingAccount.create({
        data: {
          customerId: customer.id,
          hostingPlanId: hostingPlan.id,
          provider: "mock",
          providerAccountId: `mock_hosting_seed_${i}`,
          status: "ACTIVE",
          primaryDomain: scenario.withDomain ? `${app.slug}-${i}.example.com` : null,
          usage: { storageUsedGB: 2.4, bandwidthUsedGB: 8.1, websitesUsed: 1 },
        },
      });
      hostingAccountId = account.id;
    }

    let domainId: string | undefined;
    if (scenario.withDomain) {
      const domain = await prisma.domain.create({
        data: {
          name: `${app.slug}-${i}.example.com`,
          tld: "com",
          customerId: customer.id,
          registrarProvider: "mock",
          providerRef: `mock_domain_seed_${i}`,
          status: "ACTIVE",
          registeredAt: new Date(),
          expiresAt: new Date(Date.now() + (i === 1 ? 25 : 300) * 24 * 60 * 60 * 1000),
          nameservers: ["ns1.mockdns.com", "ns2.mockdns.com"],
        },
      });
      domainId = domain.id;
    }

    const deploymentTarget = await prisma.deploymentTarget.create({
      data: {
        customerId: customer.id,
        type: scenario.deploymentType,
        provider: scenario.deploymentType === "CUSTOMER_SERVER" ? "ssh" : "cloud",
        label: scenario.deploymentType === "CUSTOMER_SERVER" ? "Customer server" : scenario.deploymentType === "PLATFORM_HOSTING" ? "Platform-managed hosting" : "Managed deployment",
        hostname: scenario.deploymentType === "CUSTOMER_SERVER" ? `198.51.100.${10 + i}` : undefined,
        port: scenario.deploymentType === "CUSTOMER_SERVER" ? 22 : undefined,
        operatingSystem: scenario.deploymentType === "CUSTOMER_SERVER" ? "Ubuntu 22.04" : undefined,
        hostingAccountId,
        domainId,
        status: "ACTIVE",
      },
    });

    const deployment = await prisma.deployment.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        applicationId: app.id,
        applicationVersionId: version.id,
        type: scenario.deploymentType,
        status: scenario.deploymentStatus,
        domainId,
        hostingAccountId,
        deploymentTargetId: deploymentTarget.id,
        previewUrl: domainId ? null : `https://${app.slug}-${i}.preview.bridgecodes.app`,
        healthStatus: scenario.deploymentStatus === "COMPLETED" ? "HEALTHY" : "UNKNOWN",
      },
    });

    const logMessages: { message: string; level: "INFO" | "ERROR" }[] =
      scenario.deploymentStatus === "FAILED"
        ? [
            { message: "Order received. Deployment queued.", level: "INFO" },
            { message: "Preparing application package.", level: "INFO" },
            { message: "Connecting to target via cloud adapter.", level: "INFO" },
            { message: "Deployment failed: could not provision hosting resources.", level: "ERROR" },
          ]
        : scenario.deploymentStatus === "COMPLETED"
          ? [
              { message: "Order received. Deployment queued.", level: "INFO" },
              { message: "Preparing application package.", level: "INFO" },
              { message: "Connecting to target via cloud adapter.", level: "INFO" },
              { message: "Installing application.", level: "INFO" },
              { message: "Configured DNS for domain.", level: "INFO" },
              { message: "Issued SSL certificate.", level: "INFO" },
              { message: "Deployment completed successfully.", level: "INFO" },
            ]
          : [
              { message: "Order received. Deployment queued.", level: "INFO" },
              { message: "Preparing application package.", level: "INFO" },
            ];

    await prisma.deploymentLog.createMany({
      data: logMessages.map((log) => ({ deploymentId: deployment.id, level: log.level, message: log.message, isCustomerVisible: true })),
    });

    await prisma.deploymentJob.create({
      data: {
        deploymentId: deployment.id,
        jobType: "run_pipeline",
        status: scenario.deploymentStatus === "COMPLETED" ? "SUCCEEDED" : scenario.deploymentStatus === "FAILED" ? "FAILED" : "RUNNING",
        attempts: scenario.deploymentStatus === "FAILED" ? 3 : 1,
        startedAt: new Date(),
        finishedAt: scenario.deploymentStatus === "COMPLETED" || scenario.deploymentStatus === "FAILED" ? new Date() : null,
        error: scenario.deploymentStatus === "FAILED" ? "Could not provision hosting resources" : null,
      },
    });

    if (hostingPlan) {
      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          type: "HOSTING",
          referenceId: hostingAccountId,
          status: "ACTIVE",
          amount: hostingAmount,
          billingCycle: "MONTHLY",
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }
}

async function seedSupportTickets(customers: { id: string; name: string }[], staffId: string) {
  const staleTickets = await prisma.supportTicket.findMany({ where: { ticketNumber: { startsWith: "TCK-SEED-" } }, select: { id: true } });
  await prisma.supportMessage.deleteMany({ where: { ticketId: { in: staleTickets.map((t) => t.id) } } });
  await prisma.supportTicket.deleteMany({ where: { id: { in: staleTickets.map((t) => t.id) } } });

  const ticketDefs = [
    { customerIndex: 0, subject: "Unable to access admin dashboard", category: "Technical", priority: "HIGH" as const, status: "IN_PROGRESS" as const },
    { customerIndex: 1, subject: "Question about renewing my domain", category: "Domain", priority: "MEDIUM" as const, status: "OPEN" as const },
    { customerIndex: 2, subject: "Requesting invoice for accounting", category: "Billing", priority: "LOW" as const, status: "RESOLVED" as const },
  ];

  for (const [i, def] of ticketDefs.entries()) {
    const customer = customers[def.customerIndex];
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: `TCK-SEED-${1000 + i}`,
        customerId: customer.id,
        subject: def.subject,
        category: def.category,
        priority: def.priority,
        status: def.status,
        messages: { create: { authorId: customer.id, authorType: "CUSTOMER", message: `Hi team, ${def.subject.toLowerCase()}. Could you help?` } },
      },
    });

    if (def.status !== "OPEN") {
      await prisma.supportMessage.create({
        data: { ticketId: ticket.id, authorId: staffId, authorType: "STAFF", message: "Thanks for reaching out — we're looking into this now." },
      });
    }
  }
}

/**
 * Two domains specifically shaped to demonstrate the renewal scheduler
 * (runDomainRenewalSweep) the moment the worker runs, without waiting for
 * real time to pass: one due soon with auto-renew off (a reminder fires),
 * one due imminently with auto-renew on (it gets auto-renewed). expiresAt
 * is recomputed relative to "now" on every seed run so the demo stays
 * meaningful no matter when the database is (re)seeded.
 */
async function seedDomainRenewalDemoScenarios(customer: { id: string }) {
  const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const reminderDomain = await prisma.domain.upsert({
    where: { name: "sunrise-consulting.com" },
    update: { expiresAt: daysFromNow(7), status: "ACTIVE", autoRenew: false },
    create: {
      name: "sunrise-consulting.com",
      tld: "com",
      customerId: customer.id,
      registrarProvider: "mock",
      providerRef: "mock_domain_seed_reminder",
      status: "ACTIVE",
      registeredAt: daysFromNow(-358),
      expiresAt: daysFromNow(7),
      autoRenew: false,
      nameservers: ["ns1.mockdns.com", "ns2.mockdns.com"],
    },
  });

  const autoRenewDomain = await prisma.domain.upsert({
    where: { name: "brightretail-shop.com" },
    update: { expiresAt: daysFromNow(2), status: "ACTIVE", autoRenew: true },
    create: {
      name: "brightretail-shop.com",
      tld: "com",
      customerId: customer.id,
      registrarProvider: "mock",
      providerRef: "mock_domain_seed_autorenew",
      status: "ACTIVE",
      registeredAt: daysFromNow(-363),
      expiresAt: daysFromNow(2),
      autoRenew: true,
      nameservers: ["ns1.mockdns.com", "ns2.mockdns.com"],
    },
  });

  const existingRecords = await prisma.dNSRecord.count({ where: { domainId: reminderDomain.id } });
  if (existingRecords === 0) {
    await prisma.dNSRecord.createMany({
      data: [
        { domainId: reminderDomain.id, type: "A", name: "@", value: "203.0.113.10", ttl: 3600 },
        { domainId: reminderDomain.id, type: "CNAME", name: "www", value: "sunrise-consulting.com.", ttl: 3600 },
        { domainId: reminderDomain.id, type: "TXT", name: "@", value: "v=spf1 include:_spf.mockmail.example ~all", ttl: 3600 },
      ],
    });
  }

  return { reminderDomain, autoRenewDomain };
}

async function main() {
  console.log("Seeding roles and permissions...");
  const roles = await seedRolesAndPermissions();

  console.log("Seeding providers...");
  await seedProviders();

  console.log("Seeding settings...");
  await seedSettings();

  console.log("Seeding categories...");
  const categories = await seedCategories();

  console.log("Seeding users...");
  const { admin, staff, customers } = await seedUsers(roles);

  console.log("Seeding applications...");
  const apps = await seedApplications(categories, admin.id);

  console.log("Seeding hosting plans...");
  const hostingPlans = await seedHostingPlans();

  console.log("Seeding orders, deployments, domains, hosting accounts...");
  await seedOrdersAndDeployments(customers, apps, hostingPlans);

  console.log("Seeding support tickets...");
  await seedSupportTickets(customers, staff.id);

  console.log("Seeding domain renewal demo scenarios...");
  await seedDomainRenewalDemoScenarios(customers[0]);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
