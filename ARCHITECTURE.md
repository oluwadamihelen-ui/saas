# BridgeCodes — Architecture

BridgeCodes is a software marketplace + managed deployment platform: customers buy
ready-made web applications, choose how they're deployed (their own server,
platform-provided hosting, or a fully managed setup), optionally register a
domain, and track the entire lifecycle from a dashboard. The platform never
owns physical infrastructure — it's an **orchestration layer** in front of
swappable third-party providers.

```
Customer → Platform (Next.js) → Provider Adapter Interface → Third-party API
                                 (Payment/Domain/DNS/Hosting/Deployment/Email)
```

This document describes the system as implemented through **Phase 1
(Foundation)**, **Phase 2 (Payments, Billing & Commercial Foundation)**,
**Phase 3 (Application Versioning & Deployment Foundation)**,
**Phase 4 (Domains)**, **Phase 5 (Hosting)**, **Phase 6 (Business
Operations)**, **Phase 7 (Advanced)**, and **Phase 8 (Production
Readiness)** — see [Phased Plan](#phased-plan).

## 1. Recommended Architecture

- **Framework**: Next.js 16 (App Router, Turbopack, React Server Components)
  for both the frontend and the backend (server actions + route handlers).
  A single deployable avoids the operational overhead of a separate API
  service for a V1, while every domain rule lives in `src/lib/services/*`
  so it could be extracted behind a REST/RPC boundary later without
  rewriting business logic.
- **Database**: PostgreSQL via Prisma ORM. One normalized relational schema
  (see `prisma/schema.prisma`) covering identity, catalog, orders, payments,
  deployments, domains, hosting, support, and audit logging.
- **Background jobs**: BullMQ + Redis. Deployment provisioning runs as a
  queued pipeline processed by a standalone worker process
  (`npm run worker`), never inline in an HTTP request.
- **Auth**: Auth.js (NextAuth v5), credentials provider, JWT sessions,
  database-backed RBAC (roles + permissions + per-user overrides).
- **Styling**: Tailwind CSS v4 with a small custom design-token layer
  (`src/app/globals.css`) — no component library dependency for visual
  identity, though Radix primitives back a few interactive components.
- **Validation**: Zod schemas at every server action / route handler
  boundary.

## 2. Database Schema

Full schema: `prisma/schema.prisma`. Key clusters:

| Cluster | Models |
|---|---|
| Identity & RBAC | `User`, `Role`, `Permission`, `RolePermission`, `UserPermission`, `Organization`, `OrganizationMember` |
| Catalog | `Category`, `Application`, `ApplicationImage`, `ApplicationFeature`, `ApplicationReview`, `ApplicationPricing`, `ApplicationLicense`, `Bundle`, `BundleItem`, `Coupon`, `Commission` |
| Commerce | `Order`, `OrderItem`, `Payment`, `PaymentWebhookEvent`, `Refund`, `Invoice`, `InvoiceItem`, `Subscription`, `RenewalEvent` |
| Versioning & Release | `ApplicationVersion`, `DeploymentSpecification`, `ApplicationArtifact` |
| Deployment | `DeploymentTarget`, `Deployment`, `DeploymentJob`, `DeploymentLog`, `DeploymentCredential` |
| Infrastructure | `Domain`, `DomainOrder`, `DNSRecord`, `HostingPlan`, `HostingAccount` |
| Providers | `Provider`, `ProviderCredential` (encrypted) |
| Operations | `SupportTicket`, `SupportMessage`, `CustomizationRequest`, `Quote`, `QuoteItem`, `Notification`, `EmailTemplate`, `NotificationSchedule`, `AuditLog`, `Setting`, `AnalyticsEvent` |

Design notes:

- **UUID primary keys** everywhere; `createdAt`/`updatedAt` on every mutable
  model; indexes on foreign keys and common filter columns (status, email,
  slug, expiry dates).
- **Multi-tenancy is modeled, not enforced yet.** `Organization` +
  `OrganizationMember` exist and `Order`/`Domain`/`Deployment`/etc. carry an
  optional `organizationId`, so a customer can belong to a company account
  later without a schema migration. V1 checkout attaches everything to the
  individual `User`.
- **`Order.fulfillmentIntent` (JSON)** captures the customer's checkout-time
  choices (deployment type, server details, requested domain) so the
  post-payment fulfillment step knows what to provision — this keeps
  `Order`/`OrderItem` about *billing*, not *provisioning*.
- **Order items preserve historical pricing.** `OrderItem.unitPrice`/`total`
  are copied at purchase time and never recomputed from the live
  `ApplicationPricing` row, so a later price change never rewrites what a
  past customer actually paid or what their invoice/PDF shows.
- **`PaymentWebhookEvent`** records every inbound webhook delivery
  (`provider` + `providerEventId`, unique together) *before* it's processed,
  so a provider's at-least-once delivery retrying the same event is a no-op
  (caught as a Prisma `P2002` unique violation) rather than a duplicate
  order-paid transition or a double-issued license.
- **`DeploymentCredential` is a separate, append-only table** holding only
  encrypted ciphertext, keyed to a `DeploymentTarget` (not a `Deployment`) —
  credentials belong to *where* the app runs, and outlive any one deployment
  attempt to that target. `Deployment` itself carries no server/credential
  fields; non-secret connection metadata (host, port, control panel) lives
  on `DeploymentTarget`.
- **License architecture** (`ApplicationLicense`) is intentionally simple —
  status enum + optional expiry/allowed domains — and does not require
  online verification by default (`requiresOnlineVerification: false`), per
  the requirement that a licensing outage must never brick a customer's app.
- **App Developer role and revenue share** are architected (`RoleKey.DEVELOPER`,
  `Application.createdById`) but not exposed in any UI yet — future work is
  additive (a `developerId` + payout ledger), not a redesign.

### 2.1 Application → Version → Spec → Artifact → Deployment

Phase 3 splits what used to be a single `ApplicationVersion` row into four
models with distinct responsibilities, so a commercial release record, a
technical runtime contract, and a build output are never conflated:

```
Application                       "School Management Pro" — the product
  └─ ApplicationVersion            "1.0.0" — a release: status (DRAFT/
                                   STABLE/DEPRECATED), isLatest/isStable
                                   flags, changelog. What a customer's
                                   license/order/invoice references.
       ├─ DeploymentSpecification  the *technical contract* for running
                                   this version: runtime, build/start
                                   commands, required services, health
                                   check path, and EnvironmentVariable
                                   rows each flagged PUBLIC or SECRET.
       └─ ApplicationArtifact      the *build output* to install:
                                   DOCKER_IMAGE / GIT_REPOSITORY /
                                   GIT_COMMIT / ARCHIVE / OTHER + a
                                   location reference.

DeploymentTarget                  "where" — a customer's server, platform
                                   hosting, or the mock demo target.
                                   Distinct from HostingProvider (which
                                   *provisions* infrastructure) and from
                                   the DeploymentAdapter (which *installs
                                   onto* it) — see §7.1.

Deployment                        one attempt to run one ApplicationVersion
                                   on one DeploymentTarget. References
                                   Customer, Order, ApplicationVersion,
                                   DeploymentTarget, and optionally Domain
                                   and a `previousDeploymentId` self-relation
                                   (used by rollback).
  └─ DeploymentJob                 the BullMQ-tracked unit of work; one per
                                   deployment attempt (initial run, retry,
                                   or rollback).
       └─ DeploymentLog            append-only, timestamped, with an
                                   `isCustomerVisible` flag so admins see
                                   the full technical trace and customers
                                   see a redacted subset.
```

`Application.createApplicationVersion()` / `publishApplicationVersion()`
(`lib/services/application-versions.ts`) atomically flip `isLatest` off the
previous version when a new one is published for the same application, so
"the latest version" is always a single, unambiguous row —
`getLatestVersion(applicationId)` is what `createDeployment()` and checkout
resolve against when a specific version isn't pinned.

## 3. Folder Structure

```
prisma/
  schema.prisma            # full data model
  seed/index.ts            # realistic seed data (roles, apps, orders, tickets...)
scripts/
  worker.ts                # standalone BullMQ worker entrypoint
  e2e-smoke.mjs             # Playwright script driving the full customer journey
src/
  app/
    (marketing)/            # public site: home, apps, categories, services,
                             # domains, hosting, pricing, about, contact, legal
    (auth)/                 # login, register
    (customer)/dashboard/   # customer portal
    (admin)/admin/          # admin & staff console
    checkout/                # checkout, mock payment page, payment callback
    api/
      auth/[...nextauth]/   # Auth.js route handler
      domains/search/       # domain availability search API
      webhooks/[provider]/  # payment provider webhooks (signature-verified,
                             # idempotent via PaymentWebhookEvent)
      invoices/[id]/pdf/    # auth-checked invoice PDF download
  auth.ts                   # Auth.js config (Node runtime, Credentials provider)
  middleware.ts              # edge-safe route guard for /admin and /dashboard
  components/
    ui/                      # design-system primitives (Button, Card, Badge...)
    marketing/, marketplace/, dashboard/, admin/, providers/
  lib/
    auth/                    # permission catalog, require*() guards, edge config;
                              # permissions-resolve.ts has no next-auth dependency
                              # so it can be imported from plain Node/test contexts
    providers/                # provider abstraction layer (see below)
    services/                 # business logic: applications, orders, checkout,
                               # fulfillment, deployments, deployment-targets,
                               # application-versions, invoice-pdf, settings,
                               # notifications, admin-metrics
    queue/                    # BullMQ queue + worker for deployment pipeline
    security/                 # encryption, structured logger, audit log
    utils/                    # id generators, formatting
  generated/prisma/           # generated Prisma client (gitignored)
tests/
  setup.ts                    # dotenv + fallback encryption key for the vitest run
  providers/, services/, queue/  # unit tests (mocked/pure logic)
  integration/                # DB-backed tests against the real local
                               # Postgres/Redis (full purchase-to-deployment
                               # journey, webhook idempotency, RBAC overrides,
                               # version publishing)
```

## 4. API Architecture

There is no separate REST API for the browser — the App Router's server
actions and route handlers are the API surface, but internal logic is never
written directly inline in a page or action. Every action calls into a
service module:

- `ApplicationService` (`lib/services/applications.ts`) — marketplace
  queries (search, filters, categories).
- `OrderService` (`lib/services/orders.ts`) — order creation, marking paid
  (idempotent), invoice generation, license issuance.
- `CheckoutService` (`lib/services/checkout.ts`) — turns a validated
  checkout form into order lines + a provider-initialized payment.
- `FulfillmentService` (`lib/services/fulfillment.ts`) — runs once per paid
  order: provisions hosting/domain via provider adapters, builds the
  `DeploymentTarget` the customer described at checkout, then hands off to
  `DeploymentService`.
- `DeploymentTargetService` (`lib/services/deployment-targets.ts`) —
  validates and creates `DeploymentTarget` rows (zod-validated
  hostname/port, SSRF-resistant), including the shared "mock infrastructure"
  target used by the demo deployment flow.
- `DeploymentService` (`lib/services/deployments.ts`) — creates
  `Deployment`/`DeploymentJob` rows against a resolved `ApplicationVersion`
  + `DeploymentTarget` and enqueues the pipeline.
- `ApplicationVersionService` (`lib/services/application-versions.ts`) —
  creates/publishes `ApplicationVersion` + `DeploymentSpecification` +
  `ApplicationArtifact`, and resolves "the latest version" for an app.
- `InvoicePdfService` (`lib/services/invoice-pdf.ts`) — renders a PDF
  invoice buffer (pdfkit) from an `Invoice` and its line items.
- `SettingsService` (`lib/services/settings.ts`) — reads platform-wide
  settings (currently the default currency) from the `Setting` table.
- `NotificationService` (`lib/services/notifications.ts`) — in-app +
  email notifications.
- `admin-metrics.ts` — read-side aggregation for the admin dashboard/analytics.

Only true external integrations (`/api/webhooks/[provider]`,
`/api/domains/search`, `/api/auth/*`) are HTTP route handlers, because they
must be reachable by something other than our own browser client.

## 5. Provider Abstraction Architecture

Every third-party category has a TypeScript interface in
`src/lib/providers/<category>/types.ts`, a `Mock*` implementation used by
default, and — for payments — three real implementations: `Paystack` (the
original V1 integration, chosen for its NGN support), plus `KoraPay` and
`NOWPayments`, added later at the user's direct request. All three
implement the identical `PaymentProvider` interface and are selected purely
by `PAYMENT_PROVIDER`, so checkout/webhook code has no provider-specific
branching. Everything else (domains, hosting, DNS, deployment execution,
email) ships as a mock with the same interface a real adapter would
implement, so swapping one in later is additive:

```
PaymentProvider      → MockPaymentProvider, PaystackPaymentProvider,
                        KoraPayPaymentProvider, NowPaymentsPaymentProvider
DomainProvider        → MockDomainProvider, NamecheapDomainProvider
                        (capabilities-flagged)
HostingProvider       → MockHostingProvider, CPanelHostingProvider
DeploymentProviderAdapter → MockDeploymentProvider   (resolved for every
                                                       provider key —
                                                       ssh/cpanel/plesk/
                                                       docker/cloud/mock —
                                                       via a registry, see
                                                       §7.1)
EmailProvider         → MockEmailProvider
```

`src/lib/providers/registry.ts` is the single place that decides which
concrete adapter backs each interface, driven by environment variables
(`PAYMENT_PROVIDER`, `DOMAIN_PROVIDER`, ...) with a database fallback
(`Provider`/`ProviderCredential`, credentials AES-256-GCM encrypted) for
credentials configured through the admin UI. Calling code (services, jobs)
only ever imports `getPaymentProvider()` etc. — never a vendor class.
`getDeploymentProvider()` delegates to the dedicated
`deploymentAdapterRegistry` (§7.1) rather than the generic env/DB lookup,
since a deployment adapter is chosen per `DeploymentTarget.provider`, not
once globally.

The `Provider` row's `mode` field is one of `MOCK | CONFIGURED | CONNECTED |
ERROR`, matching the spec's requirement to visibly distinguish "not really
wired up yet" from "verified working" in the admin UI (Providers page →
Test Connection).

`DomainProvider` capabilities are declared per adapter
(`DomainProviderCapabilities`) rather than assumed, since real registrars
vary in what they expose over API.

### 5.1 PaymentProvider interface (Phase 2)

```ts
interface PaymentProvider {
  key: string;
  capabilities: PaymentProviderCapabilities;   // e.g. { supportsRefunds,
                                                //   supportsSubscriptions,
                                                //   supportsWebhooks, ... }
  createPayment(input): Promise<PaymentInitResult>;
  verifyPayment(reference): Promise<PaymentVerification>;
  handleWebhook(payload, signature): Promise<WebhookResult>;
  refundPayment(reference, amount?): Promise<RefundResult>;
  getTransaction(reference): Promise<TransactionRecord>;
  createCustomer?(input): Promise<CustomerRecord>;         // optional
  createSubscription?(input): Promise<SubscriptionRecord>; // optional
  cancelSubscription?(id): Promise<void>;                  // optional
}
```

`capabilities` is required on every adapter and read by the UI (e.g. to hide
a "Refund" button for a provider that can't refund) rather than the code
assuming every provider supports everything. The optional `createCustomer`/
`createSubscription`/`cancelSubscription` methods let `MockPaymentProvider`
and `PaystackPaymentProvider` both implement recurring billing without
forcing every future adapter (e.g. a bank-transfer-only provider) to fake
subscription support it doesn't have.

`MockPaymentProvider` keeps an in-memory `Map` of simulated
transactions/customers/subscriptions so `verifyPayment`/`getTransaction`
return the amount/currency actually recorded at `createPayment` time — not
a hardcoded stand-in — which is what lets the webhook route's amount/
currency validation (§10) be exercised meaningfully in tests without a real
provider. Those Maps are attached to `globalThis` (the same pattern
`lib/db.ts` uses for the Prisma client), not left as plain module-level
`const`s: Next.js compiles Server Actions and Route Handlers as separate
bundles, each re-evaluating this module, so a plain module-level Map would
mean `createPayment()` (called from checkout's Server Action) and the
webhook route's `verifyPayment()` silently saw two different, independently
empty Maps — the payment would be created but never found as confirmed.
The same risk applies to *any* cached provider singleton, not just payments'
own Maps, so `registry.ts`'s `cachedPaymentProvider`/`cachedDomainProvider`/
`cachedHostingProvider`/`cachedEmailProvider` variables are all `globalThis`-
backed too — otherwise a `MockDomainProvider` or `MockHostingProvider`
constructed while handling a Route Handler would be a different instance,
with different in-memory state, than one constructed while handling a
Server Action.

## 6. Authentication & RBAC Architecture

- **Auth.js v5**, Credentials provider, JWT session strategy (no database
  session table needed for V1; OAuth/adapter-backed sessions are a drop-in
  addition later since the schema already has a normalized `User`).
- Split config: `src/lib/auth/config.ts` is edge-safe (no Prisma/bcrypt) and
  is reused by `src/middleware.ts` for route protection; `src/auth.ts`
  extends it with the Credentials provider for the Node runtime (server
  actions, the NextAuth route handler).
- **RBAC**: four seeded roles (`SUPER_ADMIN`, `STAFF`, `CUSTOMER`,
  `DEVELOPER`), a `Permission` catalog (`lib/auth/permissions.ts`), and
  `RolePermission` for default grants. `UserPermission` allows a
  `SUPER_ADMIN` to grant or revoke an individual permission for one staff
  member without creating a new role — this is the "permissions must be
  configurable" requirement.
- `lib/auth/require.ts` exposes `requireUser()`, `requireRole(...)`, and
  `requirePermission(key)` guards used at the top of every admin page/action;
  `middleware.ts` provides a coarse-grained redirect for `/admin/*` and
  `/dashboard/*` before any page code runs.

## 7. Deployment Architecture

Long-running provisioning never happens inside an HTTP request:

```
Payment webhook verified
  → markOrderPaid()            (idempotent, amount/currency re-validated)
  → fulfillOrder()              provisions hosting/domain via provider adapters,
                                 creates the DeploymentTarget the customer
                                 described at checkout
  → createDeployment()          resolves ApplicationVersion (latest, or a
                                 pinned one) + DeploymentTarget, creates
                                 Deployment (QUEUED) + DeploymentJob row
  → enqueueDeploymentPipeline()  BullMQ job, keyed by DeploymentJob.id
  → [separate worker process — processDeploymentPipeline()]
      QUEUED → PREPARING → CONNECTING → INSTALLING → CONFIGURING →
      (DATABASE_SETUP → MIGRATING, if the spec declares a database) →
      (DNS_SETUP → SSL_SETUP, if a domain is attached) →
      HEALTH_CHECK → COMPLETED   — or → FAILED / NEEDS_CUSTOMER_ACTION
  → DeploymentLog entries at every step (customer-visible subset, secrets
    redacted before they're ever written)
  → notifyUser() on completion/failure
```

The worker (`scripts/worker.ts`, run via `npm run worker`) is a separate
Node process from the web server, matching the requirement that deployment
commands run through controlled backend workers, not the browser or the
request/response cycle. A deployment reaches `COMPLETED` **only** if the
`runHealthCheck()` step actually passes — there is no code path that marks a
deployment successful before that check runs, matching the "never fake a
success state for real infrastructure" rule.

Customers see a 9-step simplified timeline
(`components/dashboard/deployment-timeline.tsx`, `DEPLOYMENT_TIMELINE_STEPS`
in `lib/services/deployments.ts`) derived from `Deployment.status`; admins
additionally see the full status enum (including `DATABASE_SETUP`/
`MIGRATING`) plus raw `DeploymentLog`/`DeploymentJob` rows for
troubleshooting. Commands are always generated from the version's
`DeploymentSpecification` (runtime, build/start command, required services)
— a customer-provided string is validated (zod, allowlist regex on
hostname/port) before it's ever stored, and never gets interpolated into a
shell command.

### 7.1 DeploymentTarget vs. HostingProvider vs. DeploymentAdapter

Three concepts that look similar are kept deliberately separate, because
conflating them is what makes a deployment system unmaintainable once a
second real adapter shows up:

| Concept | Answers | Example |
|---|---|---|
| **HostingProvider** | *Provisions infrastructure* — creates the account/server/instance to begin with. | `hostingProvider.createAccount()` in `fulfillOrder()` calls out to a hosting reseller API and gets back a `HostingAccount`. |
| **DeploymentTarget** | *Where* a deployment runs — a concrete, addressable destination. | A customer's own server (hostname/port/credentials), a `HostingAccount` the platform just provisioned, or the shared `MOCK` demo target. Always a `DeploymentTarget` row; `type` is `CUSTOMER_SERVER \| PLATFORM_HOSTING \| MANAGED \| MOCK`. |
| **DeploymentAdapter** | *How* to install onto a target — the mechanics of connecting and running commands. | `MockDeploymentProvider` today; `SSHAdapter`/`CPanelAdapter`/`PleskAdapter`/`DockerAdapter`/`CloudProviderAdapter` later, chosen by `DeploymentTarget.provider` via `deploymentAdapterRegistry.resolve(provider)`. |

A `DeploymentTarget` can exist without ever having been through
`HostingProvider` (a customer's own server), and a `HostingAccount` from
`HostingProvider` always gets wrapped in a `DeploymentTarget` before a
deployment can reference it — the pipeline only ever talks to
`DeploymentTarget` + `DeploymentAdapter`, never to `HostingProvider`
directly.

```ts
interface DeploymentProviderAdapter {
  key: string;
  validateTarget(target): Promise<ValidationResult>;
  prepareEnvironment(target, spec): Promise<void>;
  deploy(target, spec, artifact): Promise<DeployResult>;
  configureEnvironment(target, envVars): Promise<void>;
  configureDomain(target, domain): Promise<void>;
  configureSSL(target, domain): Promise<void>;
  runMigrations(target, spec): Promise<void>;
  runHealthCheck(target, spec): Promise<HealthCheckResult>;
  rollback(target, previousDeployment): Promise<void>;
  getStatus(target): Promise<TargetStatus>;
  destroy(target): Promise<void>;
}
```

`DeploymentAdapterRegistry` (`lib/providers/deployment/registry.ts`) is the
single place new adapter keys get registered; every key currently resolves
to `MockDeploymentProvider`, so registering a real `SSHAdapter` later is a
one-line change in the registry, not a rewrite of the pipeline or the
worker.

### 7.2 Retry classification & customer action

`isTransientError()` (`lib/queue/deploymentWorker.ts`) distinguishes two
failure kinds so a broken customer server config is never retried forever:

- **Transient** (network blip, target momentarily unreachable) → BullMQ
  retries the job with backoff (`attempts: 3`).
- **Configuration** (`DeploymentConfigurationError` — bad hostname/
  credentials, missing required service, health check never passes) →
  `Deployment.status` moves to `NEEDS_CUSTOMER_ACTION` and the job is not
  retried; the customer sees what needs fixing and can re-submit a
  corrected `DeploymentTarget`.

`Deployment.rollback` (admin action, `previousDeploymentId` self-relation)
calls the adapter's `rollback()` against the last known-good deployment for
the same target rather than attempting to reconstruct one from scratch.

## 8. Domain Architecture

Domain registration and renewal are purchases like any other, not a
special-cased side effect of checkout — both flow through the same
Order → Payment → `fulfillOrder()` pipeline described in §7, keyed off a
`DomainOrder` ledger row rather than acting on the registrar immediately.

```
Customer requests REGISTER or RENEW
  → initiateDomainOrder()       checks availability (REGISTER) or ownership
                                 (RENEW), gets a price quote from the
                                 registrar adapter, creates an Order +
                                 OrderItem(DOMAIN) + DomainOrder (PENDING)
  → payment provider checkout    same createPayment()/authorizationUrl flow
                                 as an application purchase
  → payment confirmed            markOrderPaid() (idempotent, validated)
  → fulfillOrder()
      → processDomainOrders()    for every PENDING DomainOrder on this
                                 order: calls registerDomain()/renewDomain()
                                 on the registrar adapter, creates/updates
                                 the Domain row, marks the DomainOrder
                                 COMPLETED or FAILED, notifies the customer
                                 either way — never silently drops a failure
```

`processDomainOrders()` runs unconditionally at the top of `fulfillOrder()`
(before the application-license/deployment logic), so a domain-only order
(a standalone registration or a renewal) is fulfilled correctly even though
it has no associated application — and a combined "app + domain" checkout
still gets its `Domain` row created before the `DeploymentTarget` that
references it is built.

### 8.1 DomainProvider pricing and statefulness

`DomainProvider.getPricingQuote(domain, years, action)` (added alongside the
interface's existing search/register/renew/transfer/DNS methods) is what
`initiateDomainOrder()` calls to price an order before creating it — pricing
is never hardcoded at the call site.

`MockDomainProvider` keeps in-memory state (module-level `Map`s, the same
pattern as `MockPaymentProvider`'s transaction store) so a domain it has
registered is reported unavailable on a later `checkAvailability()` call and
`getDomainDetails()` reflects what was actually registered, instead of fixed
canned data. That state is per-process, though — the web server and the
worker process each get their own instance — so `renewDomain(domain, years,
currentExpiresAt?)` accepts the domain's current expiry as an optional third
argument; callers always pass what our own `Domain.expiresAt` column says
(the real source of truth for "when does this expire"), so a renewal
triggered from the worker process still extends from the correct date even
though the worker's mock instance never saw the original registration.

### 8.2 DNS record management

`lib/services/dns-records.ts` validates a record's shape against its `type`
(`dnsRecordSchema`, a zod `superRefine` — an `A` record's value must be an
IPv4 address, `MX`/`SRV` require a priority, etc.) before it's ever sent to
`DomainProvider.createDNSRecord()` or persisted as a `DNSRecord` row. Both
the admin domain detail page and the customer's own domain detail page use
the same service and the same add/delete UI, scoped by ownership
(`requireUser()` + `customerId` check) on the customer side and by
`PERMISSIONS.DOMAINS_MANAGE` on the admin side.

### 8.3 Renewal notification scheduler

`runDomainRenewalSweep()` (`lib/services/domain-renewal-scheduler.ts`) is
the first *repeating* job in the codebase — every other queue (the
deployment pipeline) is triggered once per event, never on a schedule. It's
driven by a BullMQ job scheduler (`lib/queue/domainRenewalQueue.ts`,
`Queue.upsertJobScheduler`, daily) processed by a dedicated worker
(`lib/queue/domainRenewalWorker.ts`), both started from `scripts/worker.ts`
alongside the deployment worker. The sweep function itself is exported
standalone — callable directly (a test, a manual admin trigger) the same way
`processDeploymentPipeline` is, not only reachable through the queue.

Each run:

1. Reads the configurable threshold days from `NotificationSchedule`
   (key `"domain.expiry"`, e.g. `[30, 14, 7, 3, 1]`), falling back to that
   same default if the row is missing.
2. Scans `Domain` rows expiring within the widest configured window.
3. A domain past its expiry with no successful renewal is flipped to
   `EXPIRED` and the customer is notified.
4. A domain with `autoRenew: true` inside a short trigger window (3 days)
   is renewed automatically: the registrar adapter is called, the
   `Domain`/`DomainOrder`/`RenewalEvent` rows are updated, and the customer
   is notified either of the successful auto-renewal or (if the registrar
   call fails) that they need to renew manually — auto-renew failing closed
   rather than silently doing nothing.
5. A domain with `autoRenew: false` gets a reminder notification on each
   day that exactly matches a configured threshold.

`RenewalEvent` (`referenceType: "DOMAIN"`) is the durable record of where a
given domain is in this cycle (`UPCOMING` → `SUCCEEDED`/`FAILED`). The model
is generalized (`referenceType: DOMAIN | HOSTING | SUBSCRIPTION`) for exactly
this reuse; hosting's own renewal (§9) ended up not needing it, since
`Subscription.status` alone already carries the state a hosting renewal
cares about — see §9 for why.

## 9. Hosting Architecture

Hosting bills differently from domains: there's no "opt in to auto-renew"
choice to make, because there's nothing to remind the customer to do — an
`ACTIVE` `Subscription` simply bills every cycle until the customer cancels
it. So where domain renewal (§8.3) branches on a reminder-vs-auto-renew
decision, hosting renewal is one path: charge, and roll the period forward.

```
Customer requests an upgrade/downgrade or cancellation
  → changeHostingPlan() / terminateHostingAccount()  (lib/services/hosting-accounts.ts)
      calls the adapter's upgradePlan()/downgradePlan()/deleteAccount(),
      updates HostingAccount, re-prices or cancels the linked Subscription,
      audit-logs and notifies the customer -- takes effect immediately, at
      the new price starting the next billing cycle (no proration)

runHostingRenewalSweep()   (the platform's own daily job, not customer-initiated)
  → finds HOSTING Subscriptions whose nextBillingDate has arrived
  → ACTIVE, due now         charges through the same createOrder() +
                             markOrderPaid() any other purchase uses (so a
                             hosting renewal gets a real Order, Payment, and
                             Invoice, not a synthetic side effect), then
                             rolls currentPeriodStart/End and
                             nextBillingDate forward one month
  → PAST_DUE, still fresh   retried the same way -- recovers to ACTIVE if
                             the charge now succeeds
  → PAST_DUE, > 7 days      given up on: HostingAccount is suspended via
                             the adapter and the Subscription is marked
                             EXPIRED, rather than retried forever
```

`fulfillOrder()` creates the `Subscription` row at initial purchase time
(alongside the `HostingAccount` it's for) — this was a real gap fixed in
this phase: previously only seed data created that row, so a real
`PLATFORM_HOSTING` purchase would provision a working hosting account that
was then never billed again after the first month.

Since mock billing has no real gateway to fail, `runHostingRenewalSweep`'s
failure path (mark `PAST_DUE`, notify) exists for correctness and is
exercised by tests, but isn't reachable through normal mock operation —
matching how deployment health checks and domain renewals also default to
"always succeeds" in mock mode. The PAST_DUE → suspend escalation *is*
reachable and demonstrated: a subscription seeded already `PAST_DUE` and
overdue gets suspended on the very first sweep.

`getHostingProvider()` has the same env-var/DB-credential resolution shape
as `getPaymentProvider()`/`getDomainProvider()` (§5, §8.1) — a real hosting
adapter is a config change away, not a call-site rewrite. `MockHostingProvider`
lazily registers an account it's asked to act on but never saw `createAccount()`
called for (seed data, and any account created before this instance existed) —
the alternative, throwing "unknown account," would make upgrade/suspend/
downgrade fail for every seeded or cross-process account, which defeats the
point of a demo environment. `getUsage()` is deterministic per account (a
hash of its ID) rather than random noise on every call, so two reads of the
same account agree, and grows slowly with account age rather than jumping
around.

## 10. Security Architecture

- **Passwords**: bcrypt, cost factor 12.
- **Sessions**: JWT, HttpOnly cookies (Auth.js default), server-side role
  check on every protected route via middleware + per-action guards.
- **Secrets at rest**: `lib/security/encryption.ts` — AES-256-GCM,
  per-value random IV, auth tag verified on decrypt. Used for
  `ProviderCredential` and `DeploymentCredential`. The encryption key comes
  from `CREDENTIALS_ENCRYPTION_KEY` (never hardcoded); `.env.example` ships
  a placeholder, not a real key.
- **Structured, redacted logging**: `lib/security/logger.ts` emits JSON with
  a deep `redactSensitive()` pass that blanks any field whose key looks like
  a password/secret/token before it's ever written — applied to every log
  call site (auth attempts, provider calls, deployment pipeline, webhooks).
- **Webhook verification**: `/api/webhooks/[provider]` verifies an HMAC
  signature (`PaymentProvider.verifyWebhookSignature`) before any payload
  content is trusted; a frontend "payment succeeded" redirect is treated as
  a hint, not a source of truth — `/checkout/callback` re-verifies with the
  provider server-side before rendering success.
- **Webhook idempotency**: the route extracts a stable event id
  (`extractEventId()`) and inserts a `PaymentWebhookEvent` row *before*
  acting on the payload; a duplicate delivery hits the unique constraint
  (`provider` + `providerEventId`), is caught as a Prisma `P2002`, and is
  acknowledged without re-processing — a provider's at-least-once retry
  never double-issues a license or double-marks an order paid.
- **Payment amount/currency validation**: the webhook route checks the
  payload's amount/currency against the order before calling
  `markOrderPaid()` (409 on mismatch), and `markOrderPaid()` itself
  re-validates the same thing as defense-in-depth — the write path never
  trusts a single caller to have checked correctly.
- **Deployment target validation**: `deploymentTargetSchema` (zod) allowlists
  hostname format and port range before a customer-supplied target is ever
  stored or reaches the deployment pipeline, closing the SSRF/command-
  injection surface at the boundary rather than downstream.
- **Deployment log redaction**: log messages written during the pipeline are
  checked against a secret-shaped pattern (password/secret/private key)
  before being persisted as `DeploymentLog` rows, on top of the general
  `redactSensitive()` pass — a leaked credential in a provider response
  never ends up visible to a customer or in the log table.
- **Input validation**: Zod schemas on every server action and route
  handler; Prisma parameterizes all queries (no raw SQL in the codebase).
- **Audit log**: `recordAuditLog()` called from every admin mutation
  (price changes, status changes, refunds, staff/permission changes,
  provider credential updates) — never logs the credential value itself.
- **RBAC enforcement** happens server-side in every server action, not just
  in the UI (`requirePermission`/`requireRole` at the top of each action).

## 11. UI/UX Architecture

- A small token layer in `globals.css` (`--background`, `--surface`,
  `--accent`, status colors) drives every component — one accent color
  (`#4338ca`), neutral surfaces, no gradients, restrained radius/shadow.
- `components/ui/*` are the shared primitives (Button, Card, Badge, Input,
  StatusBadge, EmptyState) reused across marketing, dashboard, and admin —
  the same visual language everywhere rather than three separate designs.
- `StatusBadge` centralizes color/label mapping for every enum in the
  system (order, payment, deployment, domain, ticket, license...) so a
  status never renders inconsistently between pages.
- Deployment progress uses the same timeline component in both the customer
  and admin views (admin additionally sees technical logs).
- Loading/empty states: `EmptyState` component used wherever a list can be
  legitimately empty (no orders yet, no tickets, etc.) instead of a blank
  table.

## 12. Phased Plan

**Phase 1 — Foundation (delivered).** Project setup, full schema, auth +
RBAC, admin dashboard, customer dashboard, marketplace + detail pages,
application CRUD, checkout, orders, invoices, and an initial mock-first
deployment pipeline.

**Phase 2 — Payments, Billing & Commercial Foundation (delivered).**
`PaymentProvider` interface extended with `capabilities`, `getTransaction`,
and optional `createCustomer`/`createSubscription`/`cancelSubscription`;
webhook idempotency (`PaymentWebhookEvent`) and amount/currency validation;
order items preserve historical pricing; PDF invoice generation and
download endpoint; subscription lifecycle (`currentPeriodStart/End`,
`RenewalEvent`) with a customer subscriptions page and an admin cancel
action. Remaining: additional payment adapters (Stripe/Flutterwave) behind
the same interface, a scheduled renewal-charge cron (`RenewalEvent` rows are
created and readable today but nothing yet fires them automatically), and a
dedicated refunds queue/report beyond the current admin action.

**Phase 3 — Application Versioning & Deployment Foundation (delivered).**
`ApplicationVersion` split from `DeploymentSpecification` and
`ApplicationArtifact` (§2.1); `DeploymentTarget` as a distinct "where" entity
kept separate from `HostingProvider` and `DeploymentAdapter` (§7.1);
`DeploymentAdapterRegistry` with the expanded adapter interface
(validate/prepare/deploy/configure/migrate/health-check/rollback/destroy);
expanded `DeploymentStatus` enum with a simplified customer timeline vs.
detailed admin view; transient-vs-configuration error classification
(`NEEDS_CUSTOMER_ACTION`, never endlessly retried); deployment only reaches
`COMPLETED` after a real health check passes; customer "Deploy Your
Application" flow; admin retry/cancel/rollback actions; deployment log
secret redaction; audit logging of version/deployment actions. Remaining:
real adapters (`SSHAdapter`, `CPanelAdapter`, `PleskAdapter`,
`DockerAdapter`, `CloudProviderAdapter`) implementing
`DeploymentProviderAdapter` — the registry and pipeline are already shaped
to accept them without further changes; scheduled health-check re-runs
(currently only run once per deployment, at completion).

**Phase 4 — Domains (delivered).** Registration and renewal both flow
through the same Order/Payment/`fulfillOrder()` pipeline as any other
purchase via a `DomainOrder` ledger (§8); `DomainProvider` gained a pricing
quote method and `MockDomainProvider` gained real in-memory state so
registered domains are reflected in later availability/detail calls; DNS
record management (add/delete, type-aware validation) on both the admin and
customer domain detail pages; the renewal notification scheduler
(`runDomainRenewalSweep`, §8.3) — the first repeating BullMQ job in the
codebase — reminds customers, auto-renews opted-in domains, and expires
lapsed ones, using the `NotificationSchedule` and `RenewalEvent` models that
were previously unused schema. Remaining: a real registrar adapter (the
`DOMAIN_PROVIDER` env var is wired in `getDomainProvider()`, same shape as
payments, ready for one) and a purchasable domain transfer flow (the
`transferDomain` provider method and `DomainAction.TRANSFER` enum value
exist; nothing enqueues one yet).

**Phase 5 — Hosting (delivered).** Upgrade/downgrade/suspend/terminate on
both the admin and customer hosting detail pages, backed by
`lib/services/hosting-accounts.ts`; `MockHostingProvider` gained real
per-account state (upgrade/downgrade persist, usage is deterministic
instead of random); `getHostingProvider()` has the same env-var/DB-credential
resolution shape as payments/domains. `fulfillOrder()` now creates the
`Subscription` row a hosting purchase needs for recurring billing (a real
gap — previously only seed data created it). `runHostingRenewalSweep`
(§9) — the second repeating job in the codebase — bills due subscriptions
through the normal Order/Payment/Invoice pipeline and suspends accounts
whose billing has been failing too long. Remaining: a real hosting adapter
(the seam is wired, same as domains); admin plan CRUD (plans are still
seed-only — no create/edit UI); a standalone "buy hosting without an app"
purchase flow (today a `HostingPlan` is only purchasable as part of an
application checkout with `PLATFORM_HOSTING` selected, so the marketing
hosting page's plan cards link to the app catalog rather than a direct
purchase).

**Phase 6 — Business Operations (delivered).** Support ticketing and
settings were already delivered in earlier phases. Coupons, quotes, and
bundles — previously schema-only despite an earlier note claiming coupons
were delivered — now have full application code: `lib/services/coupons.ts`
(`validateCoupon`/`incrementCouponUsage`, percent-or-fixed, capped at the
order subtotal, checked against active window and usage limit) wired into
checkout (`couponCode` on both the app and bundle checkout forms) and
`createOrder()`, with admin CRUD at `/admin/coupons`.
`lib/services/customization-requests.ts` and `lib/services/quotes.ts`
implement the full custom-work flow: a customer submits a
`CustomizationRequest` (`/dashboard/quotes/new`), staff move it through
SUBMITTED → REVIEWING and price it into a `Quote` with line items
(`/admin/quotes/requests/[id]`), the customer accepts or declines
(`/dashboard/quotes/[id]`), and acceptance creates an Order the same way any
other purchase does — the quote only flips to ACCEPTED and the request to
CONVERTED once `fulfillOrder()` confirms payment (`processQuoteOrder()`,
mirroring the `DomainOrder`/`processDomainOrders()` ledger pattern from
Phase 4), never on accept-intent alone. `lib/services/bundles.ts` adds admin
bundle CRUD (`/admin/bundles`, items typed APPLICATION/HOSTING_PLAN/
DOMAIN/SERVICE), a marketing listing and detail page (`/bundles`), and a
checkout entry point (`/checkout/bundle/[slug]`) that creates an order with
a single BUNDLE-type line item at the bundle's flat price; `markOrderPaid()`
issues a real `ApplicationLicense` for each APPLICATION-type `BundleItem`
once that order is paid, the same as buying each app individually. Remaining:
a renewal-style notification cron for quotes nearing `expiresAt` (today a
quote simply becomes un-acceptable once expired — no reminder is sent
beforehand); domain/hosting-type bundle items are modeled and priceable but
not yet auto-fulfilled the way application items are (they still require
manual follow-up, same as a domain or hosting item on a custom quote).

**Phase 7 — Advanced (delivered).** In-app version upgrades:
`lib/services/deployments.ts` gained `upgradeDeployment()`, which queues a
fresh deployment on a different already-`isStable` `ApplicationVersion`
against the same target and marks the old one `UPGRADED` — the same
lineage pattern (`previousDeploymentId`) the admin `rollbackDeployment`
action already used, just choosing the target version by customer
selection instead of a version's configured `rollbackOf`. Two new
`DeploymentStatus` values (`UPGRADING`/`UPGRADED`) and a version picker on
the customer deployment detail page. License online-verification: `POST
/api/licenses/verify` (`lib/services/licenses.ts`) checks status, expiry,
and — if `allowedDomains` is set — the calling domain, tracking
`lastVerifiedAt`/`verificationCount` on every successful check; a customer
`/dashboard/licenses` page surfaces the key and lets the customer manage
`allowedDomains`, and `/admin/licenses` covers suspend/revoke/reactivate.
Developer marketplace + revenue share: `RoleKey.DEVELOPER` now does
something — a role-gated `/dashboard/developer` section lets a developer
submit an `Application` (created `DRAFT`, into the same admin review/publish
queue every other app goes through) and see their own apps and commission
ledger; `markOrderPaid()` creates a `Commission` row (new model) inside its
existing transaction for every direct `APPLICATION_LICENSE` line whose
application was authored by a `DEVELOPER`, at a platform-wide rate
(`Setting` key `"developer"`, admin-configurable on `/admin/settings`,
70% by default); `/admin/commissions` marks them paid. Deliberately scoped
to direct sales only — splitting a flat bundle price fairly across several
developers' apps has no single correct answer, so a bundle-derived license
never generates a commission, the same limitation already noted for
domain/hosting bundle items in Phase 6. Uptime monitoring: `uptimeQueue.ts`
/ `uptimeWorker.ts` — the third repeating BullMQ job, alongside the domain
and hosting renewal sweeps — runs `runUptimeSweep()` every 15 minutes,
re-checking every `COMPLETED` deployment through the same
`DeploymentProviderAdapter.runHealthCheck()` the one-time post-deploy check
uses, and notifies the customer only on a `HEALTHY`/`UNKNOWN` → `OFFLINE` or
`OFFLINE` → `HEALTHY` transition (not on every sweep). Remaining: real
adapters for both `DeploymentProviderAdapter.runHealthCheck` (the mock
always reports healthy, so the sweep's own logic is exercised via a seeded
pre-degraded deployment rather than genuine failure detection) and payouts
(`Commission.status` is a manually-marked ledger, not a real transfer —
consistent with this codebase never faking a third-party integration);
per-application commission rate overrides (today it's platform-wide only).

**Phase 8 — Production Readiness (delivered, not in the original 7-phase
roadmap).** Requested directly rather than drawn from the Phased Plan above:
real provider integrations beyond payments, and closing the operational
gaps no earlier phase covered. `lib/providers/email/resend.ts` is a real
Resend adapter (same shape as `PaystackPaymentProvider`: env var or DB
credential, gated behind `EMAIL_PROVIDER=resend`) — email was previously
100% mock despite `EMAIL_PROVIDER` existing in `.env.example`, since
`getEmailProvider()` never actually read it. The Paystack payment webhook
(`api/webhooks/[provider]/route.ts`) now branches on `event.type`: only
`charge.success` goes through order lookup and verification; every other
event type (subscription lifecycle, refunds, transfers) is acknowledged and
recorded for auditability without being forced through a path built for
charges, where `event.providerReference` isn't reliably an
`Order.transactionRef` at all. `lib/security/rate-limit.ts` is a
Redis-backed fixed-window limiter (no new infrastructure — reuses BullMQ's
connection) applied to login (by email), `/api/licenses/verify` and
`/api/domains/search` (by IP), and both checkout actions (by customer id).
`GET /api/health` checks Postgres and Redis connectivity for load
balancers/uptime monitors. `src/instrumentation.ts` uses Next's native
`onRequestError` hook to catch every uncaught server error in one place for
the first time, with an optional `ERROR_WEBHOOK_URL` for external alerting.
`.github/workflows/ci.yml` runs lint, typecheck, tests, and a build on every
push/PR — there was no CI at all before this. `scripts/backup-db.sh` /
`restore-db.sh` cover Postgres backup/restore, tested for real against the
dev database (a genuine `pg_dump`/`pg_restore`-compatible archive, not just
written and assumed correct). See §14 for operational detail on all of the
above. Remaining, deliberately: no Sentry SDK (the dependency-free
`onRequestError` hook already reports everywhere that matters; adding
Sentry is a drop-in addition to that same hook once there's a real DSN to
verify it against, not a rewrite) — real domain/hosting/deployment adapters
are unchanged from Phase 7 (still 100% mock; nothing about this phase's
audit found a reason to prioritize one over shipping the operational gaps
that affect every provider equally) — Paystack's `createCustomer` /
`createSubscription` / `cancelSubscription` are implemented but still
unused by any application flow (recurring billing today goes through the
platform's own Order/Subscription/renewal-sweep pattern, not a provider-
native subscription).

**Phase 8 follow-up — admin nav + KoraPay/NOWPayments (requested directly,
after Phase 8 shipped).** Two additions: (1) the customer dashboard sidebar
(`(customer)/dashboard/layout.tsx`) now appends an "Admin" link to `/admin`
for `SUPER_ADMIN`/`STAFF` sessions, mirroring the existing Developer-role nav
injection pattern — `middleware.ts` already gated the route itself, this
only makes it discoverable without typing the URL. (2)
`lib/providers/payment/korapay.ts` and `.../nowpayments.ts` are two more
real `PaymentProvider` adapters, built against each vendor's public API docs
(no live credentials available — same "build it now, activate later"
approach Paystack was built under). Both slot into every seam Paystack
already established: `registry.ts` (`PAYMENT_PROVIDER=korapay|nowpayments`),
`admin/providers/actions.ts`'s `resolveAdapter()`, the webhook route's
`SIGNATURE_HEADERS`/`resolveProvider()`, `seedProviders()`, and
`.env.example`. Two integration details differ enough from Paystack to be
worth recording: KoraPay's webhook signature (`x-korapay-signature`) is an
HMAC-SHA256 of `JSON.stringify(payload.data)` alone, not the raw body, and
its `amount` is in the currency's major unit (not kobo). NOWPayments
authenticates with a flat `x-api-key` header rather than a Bearer secret,
checkout goes through its hosted Invoice flow (`POST /invoice` →
`invoice_url`), and its IPN signature (`x-nowpayments-sig`) is an
HMAC-SHA512 of the callback body with keys sorted recursively before
stringifying. Both adapters reuse the same `charge.success` event-type
constant the webhook route already branches on — KoraPay names its success
event that natively, and the NOWPayments adapter's `handleWebhook()`
translates a `finished`/`confirmed` `payment_status` into `"charge.success"`
so no provider-aware branching was needed in the route itself.
`providerReference` for NOWPayments is deliberately our own generated
order reference, not NOWPayments' numeric payment id — that id doesn't
exist yet when `createPayment()` returns (it's allocated once the customer
starts paying), so the order reference is what's sent as NOWPayments'
`order_id` and is what comes back unchanged in both the IPN body and a
`GET /payment/?orderId=` lookup. NOWPayments has no refund API for the same
reason crypto payments can't be reversed on-chain: `capabilities.
supportsRefunds` is `false` and `refundPayment()` always throws. Both
adapters ship with unit tests (`tests/services/korapay-provider.test.ts`,
`nowpayments-provider.test.ts`) covering request shape, status mapping, and
signature verification, plus an integration test confirming the webhook
route fails safely (404, not a crash) while no credentials are configured.

**Phase 8 follow-up — user role management + buyer/developer signup
(requested directly).** Before this, there was no admin surface at all for
the `DEVELOPER` role: Admin → Customers only ever queried `role.key ===
"CUSTOMER"`, and the only way a user became a developer was a direct
database/seed edit (`prisma/seed/index.ts` creating one with
`roles.get("DEVELOPER")` — never a code path reachable from the running
app). Two changes close that gap:

1. **Admin → Users** (`/admin/customers`, renamed from "Customers" in the
   nav, route kept for URL/link stability) now lists both `CUSTOMER` and
   `DEVELOPER` accounts together, with role tabs (All/Buyers/Developers)
   and, per row, a role badge, status badge, and action buttons: "Make
   Developer"/"Revert to Buyer" and Suspend/Reactivate. The detail page
   (`/admin/customers/[id]`) carries the same actions, plus — for a
   developer — their submitted applications and a commission summary
   (reusing the aggregation `getCommissionSummaryForDeveloper` in
   `developer-applications.ts` already computes, inlined here rather than
   imported since the page needed it alongside other includes in one
   query). `src/lib/services/users.ts` is the new service backing all four
   actions (`promoteToDeveloper`, `revertToCustomer`,
   `suspendPlatformUser`, `reactivatePlatformUser`), each audit-logged.
   Staff and Super Admin accounts are deliberately out of reach of every
   one of these — `requireManageableTarget()` throws if the target user's
   role isn't `CUSTOMER` or `DEVELOPER` — because that role tier already
   has its own dedicated management surface (Admin → Staff, with
   per-permission overrides) and mixing the two paths would let a lesser
   permission accidentally touch a staff account. Wired in via
   `PERMISSIONS.CUSTOMERS_MANAGE` (STAFF doesn't hold this by default,
   matching the pre-existing view/manage split on the Customers page).
2. **`/register`** now asks "I'm signing up as" with two options — Buyer
   (`CUSTOMER`, the previous and still the default) or Developer / Seller
   (`DEVELOPER`) — before the rest of the form. `registerCustomer()` looks
   up whichever role was chosen instead of always hardcoding `CUSTOMER`.
   No other checkout/dashboard code needed to change: `middleware.ts`
   already treats `/dashboard` as open to any authenticated role, and
   checkout's server actions already call `requireUser()` rather than
   `requireRole("CUSTOMER")`, so a self-registered developer can buy just
   like a buyer, and the Developer-role dashboard nav item from Phase 7
   picks them up immediately with no change needed there either.

Remaining, deliberately: a self-registered developer's marketplace
submissions still go through the same moderation queue every developer
account does (Phase 7's `submitApplication` — DRAFT until an admin
reviews and publishes it), so opening signup doesn't bypass any review
step. Covered by `tests/integration/user-role-management.test.ts` (all
four service actions, plus the staff/admin guard) and
`tests/integration/register-account-type.test.ts` (both account types,
plus the default-omitted case and duplicate-email rejection).

**Go-live phase 1 — real domain registrar (Namecheap).** The first of
several fixes tracked from a full production-readiness audit (payments
were real; domains, hosting, DNS and deployment were still 100% mock with
no real adapter code at all). `lib/providers/domain/namecheap.ts` is a
real `DomainProvider` implementation against Namecheap's XML API
(`api.namecheap.com/xml.response`, or the sandbox host with
`NAMECHEAP_SANDBOX=true`, the default) — every command (`domains.check`,
`domains.create`, `domains.renew`, `domains.transfer.create`,
`domains.getInfo`, `domains.dns.getList/setCustom`,
`domains.dns.getHosts/setHosts`, `users.getPricing`) is a real, verified
Namecheap API command, parsed with `fast-xml-parser` (upgraded straight to
v5 rather than the vulnerable-for-XMLBuilder v4 range, even though this
adapter only ever parses responses, never builds XML). Two things differ
enough from the payment adapters to note: auth is a 3-part whitelist
(ApiUser + ApiKey + UserName all valid **and** the calling IP on the
account's whitelist — `NAMECHEAP_CLIENT_IP` must match), and DNS host
records aren't managed incrementally — `dns.setHosts` always replaces the
*entire* record set, so `createDNSRecord`/`deleteDNSRecord` read the full
set with `dns.getHosts`, splice in the change, and write the whole set
back. `getPricingQuote`'s response-tree walk (`extractPriceEntries`)
deliberately doesn't hard-code an assumed nesting depth for
`users.getPricing`'s response, since that couldn't be fully verified
without a live sandbox call — it searches the whole parsed tree for
price-shaped nodes instead, which is correct regardless of exactly how
deep Namecheap nests `Price` under `ProductType`/`ProductCategory`/
`Product`. Flagged here rather than silently assumed correct: worth one
real sandbox smoke test before flipping `NAMECHEAP_SANDBOX=false`.

Registering a domain for real means Namecheap needs a full WHOIS
registrant contact per ICANN policy, which the platform never collected
before this — `RegisterDomainInput` gained optional `registrant*` fields
(address/city/state/postal/country/phone) and
`DomainProviderCapabilities` gained `requiresRegistrantContact`
(`false` for the mock, `true` for Namecheap). `User` gained
`addressLine1`/`city`/`stateProvince`/`postalCode` (phone/country already
existed), editable on the existing Profile page. `initiateDomainOrder`
checks `requiresRegistrantContact` **before** creating the order/charging
the customer, not after — a customer must never pay for a registration
that then fails at fulfillment for a missing profile field. Namecheap's
phone format (`+CC.NNNNNNNNNN`) is normalized best-effort from a small
country→dial-code table (`formatPhone`); an unlisted country falls back to
guessing a 1–3 digit prefix, which is honestly imperfect and worth
expanding as real customer countries come in. Wired into every seam the
payment adapters established: `registry.ts`, `admin/providers`
`resolveAdapter()`, `seedProviders()`, `.env.example`
(`NAMECHEAP_API_USER/API_KEY/USERNAME/CLIENT_IP/SANDBOX`). Covered by
`tests/services/namecheap-provider.test.ts` (every command, XML request
shape and response parsing, the DNS get-then-set-back merge, the
registrant-contact guard, error/auth-failure classification) and
`tests/integration/domain-registrant-guard.test.ts` (the pre-payment
guard against a stubbed "requires contact" provider, independent of
Namecheap's actual HTTP behavior).

**Go-live phase 2 — real hosting provisioning (cPanel/WHM).**
`lib/providers/hosting/cpanel.ts` implements the full `HostingProvider`
interface against WHM's real JSON API (`createacct`, `suspendacct`,
`unsuspendacct`, `removeacct`, `accountsummary`, `changepackage`, and
`version` for the connection check) — chosen because that interface
(create an account by plan+domain, suspend/unsuspend, disk/bandwidth
usage, upgrade/downgrade package) already maps almost 1:1 onto WHM's
reseller-hosting model, unlike a VPS/compute API (DigitalOcean, etc.)
which would have meant reinterpreting what a "hosting account" is. Every
WHM API 1 call shares one response envelope
(`{metadata:{result,reason},data:{...}}`, `result===1` is success
regardless of function) and authenticates with a WHM API Token
(`Authorization: whm <username>:<token>`, generated in WHM > Development >
Manage API Tokens) rather than the account password — WHM's own
recommended method. `getUsage`'s bandwidth figure is honestly left at 0
with a comment rather than guessed: `showbw` needs a month/year parameter
and its exact response shape wasn't verifiable without a live WHM server
to test against, unlike `accountsummary`'s disk figures which are
well-documented and implemented for real; worth wiring up once there's a
sandbox account to confirm the shape against, same caveat-and-flag
approach as `namecheap.ts`'s pricing-response walk.

WHM identifies accounts by cPanel username, not an opaque id, so
`providerAccountId` for this adapter *is* the generated cPanel username
(derived from the domain, 1-16 lowercase alphanumeric chars, prefixed if
it would otherwise start with a digit). Creating a real cPanel account
also means WHM hands back a login password that nothing before this
adapter had anywhere to put — `HostingAccountRef` gained an optional
`initialPassword` (only set by `createAccount`, never `getAccount`), and
`HostingAccount` gained `controlPanelUrl` + `initialCredentialEncrypted`
(the latter encrypted with the same AES-256-GCM helper `ProviderCredential`
already uses). `fulfillOrder()` persists both when a real adapter sets
them; the customer's hosting detail page decrypts and shows a "Control
Panel Access" card (login URL, username, password) only when
`controlPanelUrl` is present — invisible for mock accounts, exactly as
before. Wired into every seam the previous adapters established:
`registry.ts`, `admin/providers` `resolveAdapter()`, `seedProviders()`,
`.env.example` (`CPANEL_HOST/PORT/USERNAME/API_TOKEN`). Covered by
`tests/services/cpanel-provider.test.ts` (every WHM function, the auth
header and URL shape, username generation including the leading-digit
edge case, disk-usage unit conversion including the "unlimited" case,
and connected/auth-failure/HTTP-error classification).

Remaining from the go-live audit, tracked for the next phases:
deployment and DNS-management adapters are still mock, the background
worker still needs its own always-on host, the seed script still needs a
production guard, and there's still no password-recovery flow.

## 13. Local Development

```bash
cp .env.example .env            # fill in DATABASE_URL / REDIS_URL for local services
npx prisma migrate dev
npm run db:seed
npm run dev                     # web app on :3000
npm run worker                  # separate terminal: deployment pipeline worker
npm test                        # vitest — unit tests plus DB-backed integration
                                 # tests (tests/integration/*) run against your
                                 # local Postgres/Redis, same as `npm run dev`
npm run test:e2e-smoke          # Playwright: full customer journey against a running dev server
```

Demo accounts (seeded, password `Passw0rd!` for all): `admin@bridgecodes.example`
(Super Admin), `ops@bridgecodes.example` (Staff), `sarah@brightretail.com` /
`david@northgaterealty.com` / `grace@clinicly.example` (Customers).

Everything runs against mock providers out of the box — no real payment,
domain, or hosting credentials required. Setting `PAYMENT_PROVIDER=paystack`
plus `PAYSTACK_SECRET_KEY` (or saving the credential from Admin → Providers)
activates the real Paystack adapter without any code change. The same shape
applies to `EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`,
`PAYMENT_PROVIDER=korapay` plus `KORAPAY_SECRET_KEY`,
`PAYMENT_PROVIDER=nowpayments` plus `NOWPAYMENTS_API_KEY` +
`NOWPAYMENTS_IPN_SECRET`, and `DOMAIN_PROVIDER=namecheap` plus
`NAMECHEAP_API_USER` + `NAMECHEAP_API_KEY` + `NAMECHEAP_USERNAME` +
`NAMECHEAP_CLIENT_IP` (the IP must be whitelisted in the Namecheap account
first, or every call fails auth regardless of how correct the key is), and
`HOSTING_PROVIDER=cpanel` plus `CPANEL_HOST` + `CPANEL_USERNAME` +
`CPANEL_API_TOKEN` (a WHM API Token, not the account password).

## 14. Operations

**Database backups.** `scripts/backup-db.sh` runs `pg_dump` (custom format,
restorable with `pg_restore`) to a timestamped file under `backups/`
(gitignored):

```bash
./scripts/backup-db.sh              # backups/saas_platform_<timestamp>.dump
./scripts/backup-db.sh --keep 7      # also prune older than the 7 most recent
```

`scripts/restore-db.sh <dump-file>` restores one (destructively — it drops
existing objects first — so it asks for interactive confirmation unless
`RESTORE_CONFIRM=yes` is set for scripted use). Both scripts strip the
`?schema=` query param Prisma's connection string convention adds, since
plain `pg_dump`/`pg_restore` don't understand it. Wire `backup-db.sh` into a
cron job for actual production use, and sync `backups/` to remote storage
(S3, GCS, ...) afterward — this script only handles the local dump; where it
ends up long-term is a deployment decision, not a platform one.

**Health check.** `GET /api/health` checks Postgres (`SELECT 1` via Prisma)
and Redis (`PING`) connectivity and returns `200` with
`{ status: "healthy", checks: {...} }` when both succeed, `503` otherwise —
point a load balancer, container orchestrator, or uptime monitor at it.

**Rate limiting.** `lib/security/rate-limit.ts` is a fixed-window counter
backed by the same Redis instance BullMQ already uses (no extra
infrastructure). Applied to: login (`auth.ts`, keyed by email — 10 attempts /
15 min), `/api/licenses/verify` and `/api/domains/search` (keyed by
`x-forwarded-for` — 60/min and 30/min), and both checkout actions (keyed by
customer id, shared across the app and bundle entry points — 10/min).

**Observability.** `src/instrumentation.ts` uses Next's native
`onRequestError` hook (stable since 15.0) to catch every uncaught server
error — Server Components, Route Handlers, and Server Actions alike — in one
place, logged through the existing structured logger. If `ERROR_WEBHOOK_URL`
is set, the same payload is also POSTed there (Sentry, a Slack incoming
webhook, anything that accepts JSON) — best-effort; a failure to deliver
never affects the response. No Sentry SDK: adding one is the natural next
step in this same seam, deferred because pulling in a full APM SDK sight
unseen, against a Next major version this new, without a real DSN to verify
it against, was a worse trade than a working dependency-free hook.

**CI.** `.github/workflows/ci.yml` runs lint, typecheck, the full test suite
(against real Postgres/Redis service containers), and a production build on
every push and pull request.
