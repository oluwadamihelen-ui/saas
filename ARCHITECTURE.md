# Forgecart — Architecture

Forgecart is a software marketplace + managed deployment platform: customers buy
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
(Foundation)** plus the queue-backed deployment pipeline that Phase 3
originally targeted (pulled forward because "orders" and "deployments" are
inseparable in the core customer journey). Phases 2 and 4–7 build on this
foundation without architectural changes — see [Phased Plan](#phased-plan).

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
| Catalog | `Category`, `Application`, `ApplicationImage`, `ApplicationFeature`, `ApplicationReview`, `ApplicationVersion`, `ApplicationPricing`, `ApplicationLicense`, `Bundle`, `BundleItem`, `Coupon` |
| Commerce | `Order`, `OrderItem`, `Payment`, `Refund`, `Invoice`, `InvoiceItem`, `Subscription` |
| Deployment | `Deployment`, `DeploymentJob`, `DeploymentLog`, `DeploymentCredential`, `ApplicationVersion` (build/runtime metadata) |
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
- **`DeploymentCredential` is a separate, append-only table** holding only
  encrypted ciphertext. `Deployment.serverConfig` (JSON) holds non-secret
  metadata (host, port, control panel) that's safe to show an admin;
  credentials never appear there or in logs.
- **License architecture** (`ApplicationLicense`) is intentionally simple —
  status enum + optional expiry/allowed domains — and does not require
  online verification by default (`requiresOnlineVerification: false`), per
  the requirement that a licensing outage must never brick a customer's app.
- **App Developer role and revenue share** are architected (`RoleKey.DEVELOPER`,
  `Application.createdById`) but not exposed in any UI yet — future work is
  additive (a `developerId` + payout ledger), not a redesign.

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
      webhooks/[provider]/  # payment provider webhooks (signature-verified)
  auth.ts                   # Auth.js config (Node runtime, Credentials provider)
  middleware.ts              # edge-safe route guard for /admin and /dashboard
  components/
    ui/                      # design-system primitives (Button, Card, Badge...)
    marketing/, marketplace/, dashboard/, admin/, providers/
  lib/
    auth/                    # permission catalog, require*() guards, edge config
    providers/                # provider abstraction layer (see below)
    services/                 # business logic: applications, orders, checkout,
                               # fulfillment, deployments, notifications, admin-metrics
    queue/                    # BullMQ queue + worker for deployment pipeline
    security/                 # encryption, structured logger, audit log
    utils/                    # id generators, formatting
  generated/prisma/           # generated Prisma client (gitignored)
tests/                        # Vitest unit tests
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
  order: provisions hosting/domain via provider adapters, then hands off to
  `DeploymentService`.
- `DeploymentService` (`lib/services/deployments.ts`) — creates
  `Deployment`/`DeploymentJob` rows and enqueues the pipeline.
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
DeploymentProviderAdapter → MockDeploymentProvider   (stands in for ssh/cpanel/plesk/docker/cloud)
EmailProvider         → MockEmailProvider
```

`src/lib/providers/registry.ts` is the single place that decides which
concrete adapter backs each interface, driven by environment variables
(`PAYMENT_PROVIDER`, `DOMAIN_PROVIDER`, ...) with a database fallback
(`Provider`/`ProviderCredential`, credentials AES-256-GCM encrypted) for
credentials configured through the admin UI. Calling code (services, jobs)
only ever imports `getPaymentProvider()` etc. — never a vendor class.

The `Provider` row's `mode` field is one of `MOCK | CONFIGURED | CONNECTED |
ERROR`, matching the spec's requirement to visibly distinguish "not really
wired up yet" from "verified working" in the admin UI (Providers page →
Test Connection).

`DomainProvider` capabilities are declared per adapter
(`DomainProviderCapabilities`) rather than assumed, since real registrars
vary in what they expose over API.

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
  → markOrderPaid()            (idempotent)
  → fulfillOrder()              provisions hosting/domain via provider adapters
  → createDeployment()          Deployment (QUEUED) + DeploymentJob row
  → enqueueDeploymentPipeline()  BullMQ job, keyed by DeploymentJob.id
  → [separate worker process]
      connect → prepare environment → install → configure →
      DNS setup → SSL setup → health check → COMPLETED/FAILED
  → DeploymentLog entries at every step (customer-visible subset)
  → notifyUser() on completion/failure
```

The worker (`scripts/worker.ts`, run via `npm run worker`) is a separate
Node process from the web server, matching the requirement that deployment
commands run through controlled backend workers, not the browser or the
request/response cycle. BullMQ retries failed jobs with exponential backoff
(`attempts: 3`); every job attempt appends to `DeploymentLog`.

Customers see a 9-step visual timeline
(`components/dashboard/deployment-timeline.tsx`) derived directly from
`Deployment.status`; admins additionally see raw `DeploymentLog` /
`DeploymentJob` rows for troubleshooting. Commands are always generated from
`ApplicationVersion` configuration (runtime, build/start command,
required services) — a customer-provided string never becomes a shell
command.

## 8. Security Architecture

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
- **Input validation**: Zod schemas on every server action and route
  handler; Prisma parameterizes all queries (no raw SQL in the codebase).
- **Audit log**: `recordAuditLog()` called from every admin mutation
  (price changes, status changes, refunds, staff/permission changes,
  provider credential updates) — never logs the credential value itself.
- **RBAC enforcement** happens server-side in every server action, not just
  in the UI (`requirePermission`/`requireRole` at the top of each action).

## 9. UI/UX Architecture

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

## 10. Phased Plan

**Phase 1 — Foundation (this delivery).** Project setup, full schema,
auth + RBAC, admin dashboard, customer dashboard, marketplace + detail
pages, application CRUD, checkout, orders, invoices. Pulled forward from
later phases because the core journey doesn't work without them:
payment abstraction + webhook verification + refunds (Phase 2), and the
full async deployment pipeline + provider adapters (Phase 3), both with
mock-first implementations and one real payment adapter (Paystack).

**Phase 2 — Payments (mostly delivered).** Remaining: additional payment
adapters (Stripe/Flutterwave) behind the same `PaymentProvider` interface,
and a dedicated refunds queue/report beyond the current admin action.

**Phase 3 — Deployment (mostly delivered).** Remaining: real adapters
(`SSHAdapter`, `CPanelAdapter`, `PleskAdapter`, `DockerAdapter`,
`CloudProviderAdapter`) implementing `DeploymentProviderAdapter`; scheduled
health-check re-runs (currently only run once per deployment).

**Phase 4 — Domains.** Schema, search UI, and `DomainProvider` interface
exist; remaining is a real registrar adapter, DNS record management UI
(model exists: `DNSRecord`), and the renewal notification scheduler
(`NotificationSchedule` model exists, not yet wired to a cron job).

**Phase 5 — Hosting.** Plans, `HostingAccount`, and the `HostingProvider`
interface exist; remaining is a real hosting adapter and
upgrade/downgrade/suspend UI beyond what the admin hosting page currently
shows read-only.

**Phase 6 — Business Operations.** Support ticketing, coupons, and settings
are delivered. Remaining: quote-to-order conversion UI (`Quote`/`QuoteItem`
schema exists), bundle checkout (`Bundle`/`BundleItem` schema exists),
and a renewal notification cron.

**Phase 7 — Advanced.** Application version upgrades (`ApplicationVersion`
already supports multiple versions per app with `isCurrent`), license
online-verification endpoint, developer marketplace + revenue share
(`RoleKey.DEVELOPER` seeded, `Application.createdById` present),
uptime monitoring beyond the single post-deploy health check.

## 11. Local Development

```bash
cp .env.example .env            # fill in DATABASE_URL / REDIS_URL for local services
npx prisma migrate dev
npm run db:seed
npm run dev                     # web app on :3000
npm run worker                  # separate terminal: deployment pipeline worker
npm test                        # vitest unit tests
npm run test:e2e-smoke          # Playwright: full customer journey against a running dev server
```

Demo accounts (seeded, password `Passw0rd!` for all): `admin@forgecart.example`
(Super Admin), `ops@forgecart.example` (Staff), `sarah@brightretail.com` /
`david@northgaterealty.com` / `grace@clinicly.example` (Customers).

Everything runs against mock providers out of the box — no real payment,
domain, or hosting credentials required. Setting `PAYMENT_PROVIDER=paystack`
plus `PAYSTACK_SECRET_KEY` (or saving the credential from Admin → Providers)
activates the real Paystack adapter without any code change.
