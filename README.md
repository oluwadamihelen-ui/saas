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
npm run dev              # web app
npm run worker           # in a second terminal — processes generation jobs
```

Visit http://localhost:3000. The worker must be running for storyboard/scene
generation to complete — without it, generation jobs sit queued in Redis.

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
    scenes/              # auth-scoped scene repository (ownership via project)
    characters/           # auth-scoped character repository
    providers/             # AIProvider/ImageProvider interfaces + mock/ implementations
    pipeline/                # generation stages: analyze-script, build-storyboard, generate-scene-image
    jobs/                     # BullMQ queues (queue.ts) + worker process (worker.ts)
    storage/                   # StorageProvider (local dev impl; swap in S3/R2 for prod)
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

## AI providers (mock-first)

`AI_PROVIDER` / `IMAGE_PROVIDER` in `.env` default to `mock`, resolved via the
factories in `src/server/providers/index.ts`. `MockAIProvider` is a
deterministic, rule-based storyboard/character generator (sentence
splitting + heuristics — not a real LLM); `MockImageProvider` renders an SVG
"scene card" placeholder rather than pretending to be a real image
generation result. Both set `isMock: true`. To add a real provider,
implement the `AIProvider`/`ImageProvider` interfaces in `src/server/providers/types.ts`
and add a case to the relevant factory function — nothing else in the app
depends on which implementation is active.

## Generation pipeline & jobs

`POST /api/projects/:id/generate` enqueues a `project-generate` BullMQ job.
The worker (`npm run worker`) runs `runScriptAnalysis` → `runBuildStoryboard`
(creates/reuses `Character` rows by name and creates `Scene` rows), then fans
out one `scene-image` job per scene. Every stage writes a `GenerationJob` row
(`queued|processing|completed|failed`) and debits credits via the ledger
before calling the provider — insufficient credits fails the job cleanly
rather than running for free. The project detail page polls
`GET /api/projects/:id/jobs` while generating and stops once scenes settle.
A single scene can be regenerated independently via
`POST /api/scenes/:id/regenerate` without rerunning the whole pipeline.

## What's implemented vs. what's next

**Phase A — Foundation**: architecture, Postgres schema, Auth.js, protected
dashboard shell, project CRUD, billing/credit ledger UI, original marketing
site.

**Phase B (this phase) — AI workflow**: mock `AIProvider`/`ImageProvider`,
BullMQ job queue + worker, script analysis → storyboard → character
extraction/reuse → scene image generation pipeline, full scene CRUD (edit,
duplicate, delete, reorder, regenerate, add), and a full character library
(create/edit/delete, generate a mock portrait, or upload your own reference
image).

**Not yet built**: the voice studio and music library (Phase C), the
timeline editor and captions (Phase C), Remotion rendering/export (Phase D),
and Stripe billing (Phase E). Nothing in this codebase fakes AI output —
scene/character generation is real (mock-provider) output end-to-end, not
hardcoded fixtures, and areas not yet built show honest "coming in Phase X"
states.
