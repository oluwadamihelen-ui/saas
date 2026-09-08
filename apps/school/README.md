# Winfield

Winfield Montessori School's AI-native school management platform —
students, staff, academics, attendance, finance, communication and an AI
assistant, built on a multi-tenant foundation (so other schools can be
onboarded the same way later). This app is being built in phases (see
[the root README](../../README.md) for the full architecture assessment and
roadmap); this commit implements **Phase 1 (Foundation)**, **Phase 2
(Academics)**, **Phase 3 (Finance)**, **Phase 4 (Communication & portals)**
and **Phase 5 (AI assistant)**:

**Phase 1 — Foundation**
- Multi-tenant data model (every tenant-owned table carries `schoolId`)
- Auth.js v5 credentials login, bcrypt-hashed passwords
- A `module.action` permission system (`students.view`, `staff.invite`, ...)
  with a per-school, per-role permission matrix seeded from a fixed catalog
- School onboarding wizard: create account → school info → academic
  structure (session/terms/classes/subjects) → invite staff
- Staff invites with a real accept-invite flow (no email provider yet, so the
  invite link is shown directly in the UI to copy/share)
- Dashboard shell (sidebar, topbar) and a main dashboard with real counts —
  modules that don't exist yet show an honest "coming in Phase N" empty
  state rather than fabricated numbers
- Student management: enroll, list (search/filter/paginate), profile
  (personal/academic/guardians/health/attendance/results tabs), edit,
  withdraw, guardian linking
- An audit log for student/attendance/results/timetable mutations

**Phase 2 — Academics**
- Teacher → subject → class assignments (`/dashboard/academics`), the
  foundation everything else in this phase authorizes against
- Attendance: daily roster marking per class, per-student history, and a
  real "% present today" stat on the dashboard (no more placeholder)
- Timetable: weekly periods per class with teacher/class double-booking
  conflict detection, plus a read-only per-teacher view
- Assignments: teacher-created, due-dated, with a gradebook per class
  (there's no student portal yet, so a teacher records submissions on the
  class's behalf rather than students self-submitting)
- Results: configurable assessment components (e.g. "1st CA"/"Exam") and
  grade bands, a score-entry grid per class/subject, and report cards with
  a real approval workflow (draft → approved → published) plus PDF export

**Phase 3 — Finance**
- Fee structures: per-school categories (Tuition, Transport, ...) and
  amounts scoped to a class and term, configurable from Finance → Fee
  structures
- Invoices: one click rolls every applicable fee structure into an invoice
  per student for a class; a per-student, per-class and overall finance
  dashboard shows revenue/outstanding/overdue in real time
- Payments: a real provider abstraction (`src/lib/payments/`) with a mock
  adapter selected via `PAYMENT_PROVIDER` — swapping in Paystack/Flutterwave
  later is a new adapter file, not a rewrite. There's no parent portal yet
  (Phase 4), so each invoice gets a shareable, unauthenticated `/pay/[token]`
  link — the same pattern as the Phase 1 staff-invite link — where a parent
  can pay online (mock checkout) or see the school's bank details and
  notify a transfer for staff to confirm
- Receipts: PDF receipts for confirmed payments, downloadable by staff and,
  via the same pay link, by the parent
- Expenses: vendors, categories, and an approval workflow — expenses at or
  above a configurable threshold need owner/admin sign-off; smaller ones
  are recorded straight through

**Phase 4 — Communication & portals**
- Notifications: an in-app bell (topbar, both staff dashboard and parent/
  student portals) triggered by real events — a report card published, an
  invoice issued, a payment confirmed, a student marked absent, an
  announcement published. Email/SMS/WhatsApp/push are schema-level
  extensibility only (`PortalInvite`/notification delivery is in-app, same
  as the Phase 2 `AttendanceMethod` precedent) — nothing claims to send
  outside the app yet
- Announcements (`/dashboard/announcements`): staff with `announcements.manage`
  create and publish notices targeted at the whole school, staff only,
  parents only, or one specific class; publishing fires a notification to
  every matching recipient. Everyone with `announcements.view` (all staff
  roles by default) can read the list
- Portal accounts: a guardian or student gets their own login via a
  `PortalInvite` link (`/portal-invite/[token]`) — the same unauthenticated,
  unguessable-token accept flow as the Phase 1 staff invite — sent from a
  student's profile (**Portal access** tab) by anyone with `guardians.manage`
  (for a parent) or `students.edit` (for the student themself)
- Parent portal (`/portal/parent`): a children list, and per child the same
  Attendance/Results/Assignments/Timetable/Fees data the staff dashboard
  shows (reusing the exact same compute functions — nothing is duplicated
  or recomputed differently), plus the announcements feed and messaging
  below. Fees link straight to the existing `/pay/[token]` flow per invoice
- Student portal (`/portal/student`): a lighter, read-only version of the
  same — timetable, assignments, results, attendance, announcements — for
  a student's own login
- Messaging: a parent starts a conversation (optionally about one specific
  child) from `/portal/parent/messages`; any staff member with
  `messages.manage` (owner/admin/principal by default — deliberately not
  teachers, since this is an admin-office inbox) replies from
  `/dashboard/messages`. Replying notifies the other side

**Phase 5 — AI assistant**
- `/dashboard/assistant`: a chat assistant over the school's own data —
  ask about a student, today's attendance, a class's results, or the
  finance summary — answered by real tool calls into the same service
  functions the dashboard uses, never invented numbers
- Every tool is gated by the same permission the equivalent dashboard page
  requires (e.g. a finance question needs `finance.view`), checked before
  the tool is even offered to the model, not just before it runs — a
  teacher's assistant literally cannot see finance data because the tool
  isn't in its list
- One write-capable tool (`mark_student_attendance`) demonstrates the
  intent → permission-check → tool-call → audit pipeline end to end: the
  model can propose it, but it sits as a confirmation card until the
  signed-in user clicks Confirm — the same human-in-the-loop principle the
  report card approve/publish workflow already uses. Every tool call that
  actually runs (read or write) is written to the audit log
- Provider abstraction (`src/lib/ai/providers/`) supporting OpenAI and
  Anthropic via `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, selected with
  `AI_PROVIDER` if both are set. **With neither key set, the assistant page
  says so plainly instead of faking a response** — there is no mock AI
  provider, unlike the mock payment gateway; see ARCHITECTURE.md for why

Not yet built (see the phased roadmap): payroll, advanced ERP modules.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma ·
Auth.js v5 · Zod · React Hook Form · OpenAI / Anthropic SDKs (assistant)

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

The AI assistant (`/dashboard/assistant`) is optional — everything else
works with no further setup. To turn it on, add `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` to `.env` (see `.env.example`) before starting the app.

### Demo accounts

The seed script creates **Winfield Montessori School** (Creche, Nursery &
Primary) with 14 class arms, 110 students, fee structures, 110 generated
invoices with a realistic mix of paid/partial/unpaid/pending-confirmation
payments, a handful of expenses (one over the approval threshold), four
published announcements (school-wide, staff-only, parents-only and one
class-scoped), and a sample parent↔school conversation — plus these
accounts, all with password `Passw0rd!23`:

| Role | Email |
|---|---|
| School Owner | owner@winfield.demo |
| School Administrator | admin@winfield.demo |
| Principal | principal@winfield.demo |
| Teacher | teacher1@winfield.demo / teacher2@winfield.demo |
| Accountant | accountant@winfield.demo |
| HR Staff | hr@winfield.demo |
| Parent (portal) | parent@winfield.demo |
| Student (portal) | student@winfield.demo |

The parent and student accounts are both linked to the same seeded child, so
signing in as either shows the same class/attendance/results/fees data from
each side. Or go to `/register` to walk through the real onboarding wizard
and create a brand-new school from scratch.

## Scripts

```bash
npm run dev        # start the app on :3001
npm run build       # production build
npm run lint         # eslint
npm run db:seed      # (re)seed the demo school — wipes any existing school with the same slug first
npm run db:backfill-permissions   # top up existing schools' roles with any permission added since they were created
```

### Upgrading an existing database

Pulling new code into a database from an earlier phase needs two steps
beyond the usual `npx prisma migrate dev`:

```bash
npx prisma migrate dev              # applies new tables/columns
npm run db:backfill-permissions     # grants any permission added to a role's defaults since your school was created
```

Each phase has occasionally added a new default permission to an existing
role (e.g. Phase 4 added `announcements.view` to every staff role). That
default is only ever applied when a school is first created — a school
that already existed doesn't retroactively gain it, so a role that should
now be able to open a page instead sees a "Missing permission" error. The
backfill script (`prisma/scripts/backfill-permissions.ts`) fixes this
without touching any of your real data — it only adds permissions a role
is missing, never removes one, and is safe to run as many times as you
like (a real-data-preserving alternative to `npm run db:seed`, which wipes
and recreates the whole demo school from scratch instead).
