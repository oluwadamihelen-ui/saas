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
**Phase 3 (Application Versioning & Deployment Foundation)**, and
**Phase 4 (Domains)**. Phases 5–7 build on this foundation without
architectural changes — see [Phased Plan](#phased-plan).

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
| Catalog | `Category`, `Application`, `ApplicationImage`, `ApplicationFeature`, `ApplicationReview`, `ApplicationPricing`, `ApplicationLicense`, `Bundle`, `BundleItem`, `Coupon` |
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
default, and — for payments — a real `Paystack` implementation, chosen as
the single "real" V1 integration because it natively supports the NGN
examples throughout the spec. Everything else (domains, hosting, DNS,
deployment execution, email) ships as a mock with the same interface a real
adapter would implement, so swapping one in later is additive:

```
PaymentProvider      → MockPaymentProvider, PaystackPaymentProvider
DomainProvider        → MockDomainProvider          (capabilities-flagged)
HostingProvider       → MockHostingProvider
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
currency validation (§9) be exercised meaningfully in tests without a real
provider. Those Maps are attached to `globalThis` (the same pattern
`lib/db.ts` uses for the Prisma client), not left as plain module-level
`const`s: Next.js compiles Server Actions and Route Handlers as separate
bundles, each re-evaluating this module, so a plain module-level Map would
mean `createPayment()` (called from checkout's Server Action) and the
webhook route's `verifyPayment()` silently saw two different, independently
empty Maps — the payment would be created but never found as confirmed.

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
given domain is in this cycle (`UPCOMING` → `SUCCEEDED`/`FAILED`), reused
rather than duplicated once hosting/subscription renewals need the same
UPCOMING → notify/auto-process → SUCCEEDED lifecycle.

## 9. Security Architecture

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

## 10. UI/UX Architecture

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

## 11. Phased Plan

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

**Phase 5 — Hosting.** Plans, `HostingAccount`, and the `HostingProvider`
interface exist; remaining is a real hosting adapter and
upgrade/downgrade/suspend UI beyond what the admin hosting page currently
shows read-only.

**Phase 6 — Business Operations.** Support ticketing, coupons, and settings
are delivered. Remaining: quote-to-order conversion UI (`Quote`/`QuoteItem`
schema exists), bundle checkout (`Bundle`/`BundleItem` schema exists),
and a renewal notification cron.

**Phase 7 — Advanced.** In-app upgrade flow for a customer moving between
already-published `ApplicationVersion`s (creating new versions and
publishing them is delivered — see §2.1 — a customer-initiated "upgrade my
running deployment" action is not), license online-verification endpoint,
developer marketplace + revenue share (`RoleKey.DEVELOPER` seeded,
`Application.createdById` present), uptime monitoring beyond the single
post-deploy health check.

## 12. Local Development

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
activates the real Paystack adapter without any code change.
