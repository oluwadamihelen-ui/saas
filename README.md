# Storyloom

An AI-powered SaaS for turning ideas or scripts into animated videos —
storyboard, consistent characters, scene visuals, narration, music and a
finished export, in one pipeline.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript), traditional dynamic
  rendering (Cache Components/PPR is not enabled)
- **Database**: PostgreSQL via Prisma ORM 7 (driver adapter: `@prisma/adapter-pg`)
- **Auth**: Auth.js (NextAuth v5), credentials provider, JWT sessions
- **Jobs/queue**: BullMQ + Redis (wired in Phase B for async AI generation)
- **Styling**: Tailwind CSS v4 with an original design token set (see
  `src/app/globals.css`)
- **Video rendering**: Remotion (Phase D)
- **Storage**: S3-compatible object storage behind a `StorageProvider`
  abstraction (Phase B/D)

## Local development

### Prerequisites

- Node.js 22+
- PostgreSQL 16 and Redis running locally (see below)

### Database & Redis

This repo ships a `docker-compose.yml` for Postgres + Redis. If Docker isn't
available in your environment, install them natively instead:

```bash
# Docker (preferred where available)
docker compose up -d postgres redis

# or natively on Debian/Ubuntu
sudo apt-get install -y postgresql redis-server
sudo service postgresql start
sudo service redis-server start
```

Create the app database/role to match `.env.example`:

```sql
CREATE ROLE saas LOGIN PASSWORD 'saas_dev_password' CREATEDB;
CREATE DATABASE saas OWNER saas;
```

### Environment variables

```bash
cp .env.example .env
npx auth secret   # writes a fresh AUTH_SECRET into .env
```

See `.env.example` for the full list — AI/image/video/voice/music providers
default to `mock`, so the app runs completely without external API keys.

### Install & run

```bash
npm install
npx prisma migrate dev   # applies the schema, generates the client
npm run dev
```

Visit http://localhost:3000.

## Project structure

```
src/
  app/
    (marketing)/     # public site: landing, features, pricing, faq, contact...
    (auth)/           # login, signup, password reset
    (app)/             # authenticated dashboard (protected by proxy.ts)
    api/                # route handlers
  server/
    auth/              # Auth.js config (edge-safe + full), session helpers
    db/                # Prisma client singleton
    credits/           # credit ledger
    projects/           # auth-scoped repositories
    providers/          # AI provider interfaces + mocks (Phase B)
    pipeline/            # generation pipeline stages (Phase B)
    jobs/                # BullMQ queues/workers (Phase B)
    storage/              # StorageProvider (Phase B/D)
  components/
    ui/                # base design system (Button, Card, Input, Badge...)
    marketing/           # public site sections/forms
    dashboard/            # authenticated app components
  lib/                # validation schemas, plans/credit config, utilities
prisma/
  schema.prisma        # full data model
docker-compose.yml     # Postgres + Redis for local/dev parity with prod
```

## Auth & authorization

- `src/proxy.ts` (Next.js 16's renamed `middleware.ts`) redirects
  unauthenticated requests away from protected route prefixes.
- Every data-access function in `src/server/*/repository.ts` is scoped by
  `userId` — API routes call `requireUserId()` and never trust a
  client-supplied id without an ownership check in the query itself.
- Passwords are hashed with bcrypt; password reset uses single-use,
  hashed, expiring tokens (`VerificationToken`).

## Credits & plans

`src/lib/plans.ts` defines plan tiers and per-operation credit costs.
Prices are intentionally left undecided (`TBD` on the pricing page) until
business decisions are made. All balance changes go through
`applyCreditDelta` in `src/server/credits/ledger.ts`, which writes an
auditable `CreditLedgerEntry` for every grant and charge.

## What's implemented vs. what's next

**Phase A (this phase) — Foundation**: architecture, Postgres schema, Auth.js,
protected dashboard shell, project CRUD, billing/credit ledger UI, original
marketing site.

**Not yet built** (see the phased roadmap): AI script/storyboard generation,
character consistency engine, scene image/video/voice/music generation, the
scene editor and timeline, captions, Remotion rendering/export, and Stripe
billing. Nothing in this codebase fakes AI output — pages for these areas
show honest "coming in Phase X" states rather than mocked results.
