# BridgeCodes

A software marketplace and managed deployment platform: browse production-ready
web applications, buy a license, choose how it gets deployed (your own server,
platform hosting, or a fully managed setup), optionally register a domain, and
track the whole thing from a dashboard. Billing supports one-time and
recurring (subscription) pricing with PDF invoices, and every application
release is a versioned record (`ApplicationVersion` + its deployment spec)
that a deployment is created against — so "what got deployed" is always
traceable back to a specific version, order, and target.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design, provider
abstraction layer, and phased roadmap.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma ·
Auth.js v5 · BullMQ + Redis · Zod

## Getting started

Requirements: Node 20+, PostgreSQL, Redis.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, REDIS_URL, CREDENTIALS_ENCRYPTION_KEY
npx prisma migrate dev
npm run db:seed
npm run dev                # http://localhost:3000
```

In a second terminal, run the worker process (required for purchases to
progress past "Queued", and for domain renewal reminders/auto-renewal and
recurring hosting billing):

```bash
npm run worker
```

### Demo accounts

All seeded with password `Passw0rd!`:

| Role | Email |
|---|---|
| Super Admin | admin@bridgecodes.example |
| Staff | ops@bridgecodes.example |
| Customer | sarah@brightretail.com |
| Customer | david@northgaterealty.com |
| Customer | grace@clinicly.example |

The platform runs entirely on mock payment/domain/hosting/deployment/email
providers by default — the full purchase → deployment journey works with no
external credentials. See Admin → Providers to inspect provider status, and
`.env.example` for how to switch a category to a real adapter.

### The purchase → deployment journey

1. **Admin** creates an application, adds a version (e.g. `1.0.0`) with a
   deployment specification (runtime, build/start commands, env vars, health
   check path) under Admin → Applications → Versions, and publishes it.
2. **Customer** buys the application; on payment confirmation
   (`/api/webhooks/[provider]`, idempotent and amount-validated) the order
   moves to `PAID` and a PDF invoice is generated.
3. **Customer** goes to Dashboard → Deployments → Deploy Your Application and
   picks a target — their own server, platform hosting, or the built-in mock
   "demo infrastructure" target (no real server needed to try the flow).
4. The **deployment pipeline worker** (`npm run worker`) picks up the queued
   job and walks the deployment through
   `QUEUED → PREPARING → CONNECTING → INSTALLING → CONFIGURING → HEALTH_CHECK
   → COMPLETED`, writing a log entry at each step. A deployment only reaches
   `COMPLETED` once its health check actually passes.
5. **Customer** sees a live progress timeline and a "successfully deployed"
   state; **admin** sees the same deployment with full technical logs, plus
   retry/rollback/cancel actions.

## Scripts

```bash
npm run dev              # start the app
npm run worker           # deployment pipeline + domain renewal + hosting billing schedulers
npm run build             # production build
npm run lint               # eslint
npm test                   # vitest — unit tests + DB-backed integration tests
                            # (tests/integration/*), run against the same
                            # local Postgres/Redis as `npm run dev`
npm run test:e2e-smoke     # Playwright smoke test of the full customer journey
                            # (requires `npm run dev` running in another terminal)
npm run test:e2e-acceptance # Playwright walkthrough of purchase -> deployment
                            # request -> worker pipeline -> COMPLETED, checked
                            # from both the customer and admin side (requires
                            # `npm run dev` and `npm run worker` running)
npm run db:seed            # (re)seed the database
```
