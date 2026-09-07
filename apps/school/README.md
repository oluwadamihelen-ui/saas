# Winfield

Winfield Montessori School's AI-native school management platform —
students, staff, academics, attendance, finance, communication and an AI
assistant, built on a multi-tenant foundation (so other schools can be
onboarded the same way later). This app is being built in phases (see
[the root README](../../README.md) for the full architecture assessment and
roadmap); this commit implements **Phase 1 — Foundation**:

- Multi-tenant data model (every tenant-owned table carries `schoolId`)
- Auth.js v5 credentials login, bcrypt-hashed passwords
- A `module.action` permission system (`students.view`, `staff.invite`, ...)
  with a per-school, per-role permission matrix seeded from a fixed catalog
- School onboarding wizard: create account → school info → academic
  structure (session/terms/classes/subjects) → invite staff
- Staff invites with a real accept-invite flow (no email provider yet, so the
  invite link is shown directly in the UI to copy/share)
- Dashboard shell (sidebar, topbar) and a main dashboard with real counts —
  modules that don't exist yet (attendance, finance, AI insights) show an
  honest "coming in Phase N" empty state rather than fabricated numbers
- Student management: enroll, list (search/filter/paginate), profile
  (personal/academic/guardians/health tabs), edit, withdraw, guardian linking
- An audit log for student create/update/withdraw

Not yet built (see the phased roadmap): attendance, timetable, assignments,
exams/results, finance, payroll, communication, parent/student portals, AI.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma ·
Auth.js v5 · Zod · React Hook Form

## Getting started

Requirements: Node 20+, PostgreSQL.

```bash
npm install                # from the repo root (installs all workspaces)
cd apps/school
cp .env.example .env       # fill in DATABASE_URL (a DIFFERENT database from apps/marketplace), AUTH_SECRET
npx prisma migrate dev
npm run db:seed            # seeds a demo school with 110 students
npm run dev                # http://localhost:3001
```

### Demo accounts

The seed script creates **Winfield Montessori School** (Creche, Nursery &
Primary) with 14 class arms, 110 students, and these staff accounts — all
with password `Passw0rd!23`:

| Role | Email |
|---|---|
| School Owner | owner@winfield.demo |
| School Administrator | admin@winfield.demo |
| Principal | principal@winfield.demo |
| Teacher | teacher1@winfield.demo / teacher2@winfield.demo |
| Accountant | accountant@winfield.demo |
| HR Staff | hr@winfield.demo |

Or go to `/register` to walk through the real onboarding wizard and create a
brand-new school from scratch.

## Scripts

```bash
npm run dev        # start the app on :3001
npm run build       # production build
npm run lint         # eslint
npm run db:seed      # (re)seed the demo school — wipes any existing school with the same slug first
```
