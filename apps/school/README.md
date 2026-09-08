# Winfield

Winfield Montessori School's AI-native school management platform —
students, staff, academics, attendance, finance, communication and an AI
assistant, built on a multi-tenant foundation (so other schools can be
onboarded the same way later). This app is being built in phases (see
[the root README](../../README.md) for the full architecture assessment and
roadmap); this commit implements **Phase 1 (Foundation)**, **Phase 2
(Academics)**, **Phase 3 (Finance)**, **Phase 4 (Communication & portals)**,
**Phase 5 (AI assistant)**, **Phase 6 (Advanced ERP)**, **Phase 7 (SaaS
billing & platform admin)** — every phase in the original brief — plus an
**Administration** module reorganizing the sidebar into nested submenus,
matching a reference school-management system's information architecture,
and **multi-provider payments & portal branding**, letting each school
connect its own online payment gateway and make its portal look like its
own:

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

**Phase 6 — Advanced ERP**
- Payroll (`/dashboard/payroll`): a per-school catalog of salary components
  (earnings/deductions), a salary structure per staff member, and payroll
  runs that generate one payslip per configured staff member — draft →
  approve → mark paid, each step one-way. A payslip snapshots the staff
  member's structure at generation time, so editing their structure later
  never changes a payslip that's already been generated
- Library (`/dashboard/library`): a book catalog with a derived (never
  manually adjusted) available-copies count, and a loan ledger — issue to a
  student or staff member, mark returned or lost
- Transport (`/dashboard/transport`): vehicles, routes with ordered stops
  and pickup/drop-off times, and student-to-route assignments
- Hostel (`/dashboard/hostel`): hostels, rooms with a fixed bed capacity,
  and student-to-room assignments (blocked once a room is full)
- The `LIBRARIAN` and `TRANSPORT_MANAGER` roles — seeded since Phase 1 but
  unused until now — get real permissions for the first time; hostel
  management goes to `HR_STAFF` instead, since no dedicated role was
  pre-seeded for it

**Phase 7 — SaaS billing & platform admin**
- A platform Super Admin — one global account, not tied to any school —
  gets its own app at `/platform`: an overview, a schools list/detail
  (change a school's account status, subscription plan and status, generate
  and mark platform invoices paid), subscription plan management, a
  dedicated billing dashboard, and an Enterprise inquiries inbox (see
  "Subscription & billing system" below). There is no self-serve way to
  become one — `npm run platform:create-admin` is the only way to create
  this account
- This bills the *school* for using Winfield — a completely separate thing
  from Phase 3's Invoice/Payment, which bills a *student's family* for
  school fees. The two never touch each other

**Subscription & billing system**
- Four plans — `Starter` (₦25,000/mo, ₦250,000/yr, up to 150 students),
  `Professional` (₦60,000/mo, ₦600,000/yr, up to 500 students, most
  popular), `Premium` (₦120,000/mo, ₦1,200,000/yr, up to 1,500 students)
  and `Enterprise` (custom pricing, unlimited students) — with a public,
  monthly/annual comparison page at `/pricing`, feature-by-feature
  ("Compare plans" table) against a fixed catalog in
  `src/lib/billing/features.ts`
- What each plan actually unlocks is centralized in
  `src/lib/billing/entitlements.ts` (`hasFeature`/`requireFeature`,
  `getStudentLimit`/`requireStudentCapacity`) — the one place any
  page/action/AI tool checks entitlement, never a scattered
  `if (plan === "professional")`. A plan's feature matrix
  (`SubscriptionPlan.features`) is Super-Admin-editable at
  `/platform/plans` without a deploy
- Every new school gets a 14-day trial with full **Professional**-tier
  access, no card required (`createSchoolWithOwner` in
  `src/lib/school-provisioning.ts`); status transitions (trial → expired,
  active → past-due → expired) are computed lazily the next time anything
  reads the subscription — this app has no background job runner, so
  there's no cron to drift out of sync with the database
- Schools manage their own plan at `/dashboard/billing` — upgrade/downgrade
  (a downgrade below the new plan's student limit is refused, never
  auto-deletes anyone), cancel/renew, and pay an outstanding invoice online
  (`/dashboard/billing/confirm` mirrors the parent-facing pay/confirm flow,
  inside the dashboard's own layout throughout)
- Schools pay Winfield through the same `PaymentProvider` abstraction the
  parent-facing gateways use (`src/lib/payments/types.ts`), resolved
  against Winfield's *own* Paystack keys
  (`PLATFORM_PAYSTACK_PUBLIC_KEY`/`PLATFORM_PAYSTACK_SECRET_KEY` — a
  different thing entirely from a school's own gateway credentials) via
  `src/lib/billing/payment-provider.ts`; unset in dev, so it falls back to
  a simulated checkout, same principle as every other payment flow in this
  app. `/api/webhooks/platform-paystack` is signature-verified and
  idempotent (`BillingEvent`, unique on provider + external event id)
- The platform billing dashboard (`/platform/billing`) shows MRR/ARR,
  subscriptions by status, revenue by billing interval, plan mix, a 30-day
  churn rate, trials ending within 7 days, and overdue invoices — all
  computed from real data, no synthetic figures. `/platform/inquiries` is
  the inbox for the pricing page's Enterprise "talk to us" form — it only
  ever records an inquiry, never auto-creates a subscription
- `npm test` (vitest) covers plan pricing, student-limit boundaries (150th
  allowed/151st blocked, and so on per tier), feature access per tier,
  cross-school isolation, trial/status lazy-reconciliation, the
  upgrade/downgrade/cancel/renew service layer (downgrade-never-deletes),
  and the webhook's signature check + idempotency

**Administration — nested navigation, admission, calendar, feedback**
- The sidebar (dashboard, portal and platform, desktop and mobile) now
  supports arbitrary-depth collapsible groups, not just a flat list —
  built once as a shared `NavTree` component so every nav surface stays
  visually and behaviourally consistent
- User: an **All Users** directory across every role (staff and portal
  accounts) and a **Reset Password** tool, both gated by `users.manage`
- Admission: a public, unauthenticated application form at `/apply/[slug]`
  (share the link with prospective parents — no login required) *and* a
  staff-facing **Applicants** pipeline
  (`Applied → Under review → Offered → Accepted/Rejected`), with an
  optional admission fee (bank-transfer, confirmed by staff) and a **Full
  Admission Process** action that admits an accepted applicant into a real
  student record
- Calendar: school events/activities with an optional class, term and
  parent/staff notification, and an automatic **archive** of past events —
  nothing to mark manually
- Feedback: any signed-in user — staff, parent or student — can submit a
  suggestion or concern; staff with `feedback.manage` mark it reviewed

**Multi-provider payments & portal branding**
- Each school connects its own **Paystack**, **Flutterwave** or **Korapay**
  account from Dashboard → Settings — secret keys are encrypted at rest
  and never re-displayed once saved, only the owner role
  (`payment_gateways.manage`) can manage them, and a school picks which
  connected gateway "Pay online" actually uses. The original manual
  (staff-recorded) and bank-transfer options are unchanged
- A school that hasn't connected a gateway keeps working exactly as
  before — "Pay online" runs a simulated demo payment, on both an
  invoice's pay page and the admission application fee, so nothing about
  the existing flow requires setup to keep functioning
- A real gateway payment is verified server-side against that gateway's
  own API when the payer is redirected back (never trusted on the
  redirect alone), with webhook endpoints
  (`/api/webhooks/{paystack,flutterwave,korapay}`) as an additional,
  signature-verified confirmation path
- Branding (Dashboard → Settings): upload a logo and pick a brand color —
  recolors buttons, links and highlights across your dashboard, portals,
  and the public `/apply/[slug]` and `/pay/[token]` pages. Nothing to set
  up keeps the default Winfield look

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
class-scoped), a sample parent↔school conversation, salary structures and
two payroll runs (one paid, one still draft) for six staff members, a small
book catalog with a few loans issued, two transport routes with stops and
assigned students, two hostels with rooms and assigned students, (Phase 7)
the four default subscription plans plus this school's own **Professional**
subscription with two paid platform invoices and one pending, a second demo
school ("Bright Path Academy") on a 14-day **Starter** trial, (Administration) a
configured admission fee with six applicants spanning every pipeline
stage (including one already admitted into a real student record), a mix
of upcoming and archived calendar events, and a handful of feedback
submissions, and a distinct brand color plus a connected-but-inactive
demo Paystack credential (a fake test key — "Pay online" still runs the
simulated gateway; connecting it as *active* would only work with a
real Paystack account) so Settings has real examples of both features
to look at — plus these accounts, all with password `Passw0rd!23`:

| Role | Email |
|---|---|
| School Owner | owner@winfield.demo |
| School Administrator | admin@winfield.demo |
| Head of School | principal@winfield.demo |
| Teacher | teacher1@winfield.demo / teacher2@winfield.demo |
| Accountant | accountant@winfield.demo |
| HR Staff | hr@winfield.demo |
| Librarian | librarian@winfield.demo |
| Transport Manager | transport@winfield.demo |
| Parent (portal) | parent@winfield.demo |
| Student (portal) | student@winfield.demo |
| Platform Super Admin | superadmin@winfield.demo |
| School Owner (Bright Path Academy, Starter trial) | owner@brightpath.demo |

The parent and student accounts are both linked to the same seeded child, so
signing in as either shows the same class/attendance/results/fees data from
each side. The Super Admin account lands on `/platform`, not `/dashboard` —
it isn't attached to any school. Or go to `/register` to walk through the
real onboarding wizard and create a brand-new school from scratch (it's
automatically enrolled on the Professional-tier 14-day trial described
above).

## Scripts

```bash
npm run dev        # start the app on :3001
npm run build       # production build
npm run lint         # eslint
npm test             # vitest — billing/entitlements/webhook suite (needs DATABASE_URL, uses vitest-* prefixed throwaway schools)
npm run db:seed      # (re)seed the demo school — wipes any existing school with the same slug first
npm run db:backfill-permissions   # top up existing schools' roles with any permission added since they were created
npm run platform:create-admin -- --email=you@example.com --password=... --name="Your Name"
                     # create a real platform Super Admin account (only way to get one — no self-serve signup)
```

### Upgrading an existing database

Pulling new code into a database from an earlier phase needs two steps
beyond the usual `npx prisma migrate dev`:

```bash
npx prisma migrate dev              # applies new tables/columns
npm run db:backfill-permissions     # syncs each role to the current default permission matrix
```

If your `.env` predates multi-provider payments, also add `PAYMENT_KEYS_SECRET` (see `.env.example`) — it falls back to `AUTH_SECRET` if you skip it, so this is optional, not required, to keep running.

Each phase has occasionally changed the default permission matrix for an
existing role — added a permission (e.g. Phase 4 added `announcements.view`
to every staff role), removed one (e.g. `students.create` was later
restricted away from `SCHOOL_ADMIN`), or given a role real permissions for
the first time (e.g. Phase 6 gave `LIBRARIAN`/`TRANSPORT_MANAGER` more than
just dashboard access). That default is only ever applied when a school is
first created — a school that already existed doesn't retroactively pick
up the change, so a role can end up with a page it shouldn't see, or a
"Missing permission" error on one it now should. The backfill script
(`prisma/scripts/backfill-permissions.ts`) fixes this without touching any
of your real data (students, invoices, attendance, etc.) — it reconciles
every role's permissions to match the current `ROLE_DEFAULT_PERMISSIONS` in
code, both granting and revoking as needed, and is safe to run as many
times as you like (a real-data-preserving alternative to `npm run db:seed`,
which wipes and recreates the whole demo school from scratch instead). It
assumes no school has customized its own role permissions away from the
defaults — safe today since there's no role-editing UI yet, but this script
will need to become smarter once one exists.
