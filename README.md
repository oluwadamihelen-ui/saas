# Monorepo

This repository hosts two independent products as npm workspaces:

| App | Path | What it is |
|---|---|---|
| **marketplace** | [`apps/marketplace`](./apps/marketplace) | BridgeCodes — an existing, already-built software marketplace + managed deployment platform. Untouched. See its own [README](./apps/marketplace/README.md) / [ARCHITECTURE.md](./apps/marketplace/ARCHITECTURE.md). |
| **school** | [`apps/school`](./apps/school) | A new, from-scratch AI-powered, multi-tenant school management platform. See its [README](./apps/school/README.md) / [ARCHITECTURE.md](./apps/school/ARCHITECTURE.md). |

The two apps share nothing at runtime — separate databases, separate auth,
separate deploys — they only share this git history and root-level tooling
(npm workspaces install).

## Getting started

```bash
npm install                     # installs both workspaces from the root
npm run dev:marketplace          # -> apps/marketplace, http://localhost:3000
npm run dev:school               # -> apps/school, http://localhost:3001 (set PORT)
```

Each app has its own `.env` (copy from its `.env.example`) and its own
Postgres database — point `DATABASE_URL` at two different databases (or two
different Postgres instances) so the two products stay fully isolated.

**On Windows?** See [`WINDOWS_SETUP.md`](./WINDOWS_SETUP.md) for step-by-step
Command Prompt instructions.

---

## School platform — architecture assessment (Phase 1 kickoff)

This section is the assessment requested for the school management platform
build, kept here because the product doesn't exist yet as of this commit.
Ongoing/updated documentation for it lives in
[`apps/school/ARCHITECTURE.md`](./apps/school/ARCHITECTURE.md).

**1. Current architecture** — Nothing existed for this product; `apps/school`
is a fresh Next.js 16 app. It reuses the marketplace app's proven stack
(Next.js App Router, TypeScript, Prisma/Postgres, Auth.js v5, Tailwind v4,
Radix-based UI primitives, Zod, React Hook Form) as boilerplate but has its
own database, schema, auth realm, and no shared code with `apps/marketplace`.

**2. Recommended technology architecture** — Next.js App Router for both the
UI and the API layer (route handlers + server actions), PostgreSQL via
Prisma as the source of truth, BullMQ/Redis reserved for async work
(AI generation jobs, bulk imports, notification fan-out) starting Phase 5,
a thin AI-provider abstraction (Phase 5) sitting behind an intent → permission
check → tool-call pipeline, never given raw DB access.

**3. Database architecture** — Normalized relational schema, one `School` row
as the tenant root; every tenant-owned table carries a non-nullable
`schoolId` foreign key plus an index, enforced by application-layer scoping
(see below) rather than Postgres RLS for Phase 1 (RLS is a good hardening
candidate for a later phase once the query layer is stable). Money is stored
as integer minor units; every mutating table gets `createdAt`/`updatedAt`.

**4. Multi-tenancy strategy** — Shared database, shared schema, `schoolId`
discriminator column (the standard, most operationally simple approach at
this scale — see section 44's 10 → 10,000 school growth path). A single
`lib/tenant.ts` helper (`requireSession` → `schoolId`) is the *only* sanctioned
way route handlers/server actions read the current tenant; every Prisma call
for a tenant-owned model is written through small per-model repository
functions that take `schoolId` as a mandatory first argument, so a query that
forgets to scope is a compile error, not a runtime data leak. Tenant-isolation
tests (School A can never read/write School B's rows) are part of Phase 1's
definition of done, not deferred.

**5. AI architecture** — Deferred to Phase 5 per the phased build strategy;
not stubbed with fake responses in the UI before it's real (fake "AI" text
would violate the "no scripted AI responses" requirement). The intent →
permission-check → tool-call → audit pipeline described in the brief will be
built as a typed tool registry once there's enough real data (attendance,
results, fees) for it to reason over.

**6. Auth/authorization strategy** — Auth.js v5 credentials provider,
bcrypt-hashed passwords, JWT session carrying `userId`, `schoolId`, and role;
a `module.action` permission-string system (e.g. `students.view`,
`finance.approve`) with a seeded default role → permission matrix per the
role list in section 3 of the brief, editable per-school later. Authorization
is enforced server-side only (route handlers/server actions re-check
permissions; nothing trusts a client-sent role).

**7. Module breakdown** — Matches the brief's 7 phases; Phase 1 in this
commit covers: auth, tenancy, users/roles/permissions, school onboarding
(account → school info → academic structure → invite staff; CSV import and
fee/grading config are stubbed as "coming in Phase 2/3" rather than faked),
core design system, main dashboard (real counts only — no invented attendance
or revenue numbers until those modules exist), and student management
(full CRUD, tenant-scoped, permission-checked).

**8. Development roadmap** — Phase 1 (this change) → Phase 2 Academics
(classes/attendance/timetable/results) → Phase 3 Finance → Phase 4
Communication/portals → Phase 5 AI → Phase 6 Advanced ERP → Phase 7 SaaS
billing/platform admin, exactly as sectioned in the brief.

**9. What's built first** — Tenancy + auth + RBAC, because every later module
depends on "which school, which user, what are they allowed to do" being
correct and tested; then onboarding (a school has to exist with real data
before a dashboard means anything); then the dashboard shell + student
management as the first real domain module, proving the whole stack
end-to-end (schema → server action → permission check → UI) before Phase 2
adds volume.

**10. Architectural risks** — (a) shared-schema multi-tenancy means a single
missed `schoolId` filter is a cross-tenant leak — mitigated by routing all
access through scoped repository functions plus dedicated isolation tests,
with Postgres RLS as a future hardening layer; (b) the "AI must never bypass
permissions" requirement means the tool layer has to be designed before
Phase 5, not bolted on after — the permission-string system is being built
now so AI tools in Phase 5 reuse the exact same checks as the UI; (c) result
approval / report-card publishing / payroll workflows all have "human must
confirm" gates baked into the brief — those need explicit status/workflow
state machines (not just CRUD) when Phase 2/3/6 land, so the schema leaves
room for `status` + approval columns rather than hard-deleting/overwriting
records.
