# Schoolum — Architecture

Schoolum is a multi-tenant AI-native school management platform. This document
describes the system as implemented through **Phase 1 (Foundation)**,
**Phase 2 (Academics)**, **Phase 3 (Finance)**, **Phase 4 (Communication &
portals)** and **Phase 5 (AI assistant)** — see the [root README](../../README.md#school-platform--architecture-assessment-phase-1-kickoff)
for the initial assessment this build started from, and the phased roadmap
below for what comes next.

```
Browser → Next.js App Router (UI + Server Actions + Route Handlers) → Prisma → PostgreSQL
```

There is no separate API tier yet — Server Actions and a handful of Route
Handlers (`/api/auth/*`) are the application's API surface, and the frontend
never talks to Prisma directly (all data access is server-only, behind
`import "server-only"` guards). A dedicated REST/API layer factors out of
this the moment something other than this Next.js app needs to call it (a
mobile app, the future AI tool layer's out-of-process work, etc.) — see
[AI architecture](#ai-architecture-not-yet-built) below.

## Multi-tenancy

Shared database, shared schema, `schoolId` discriminator column. Every
tenant-owned Prisma model carries a non-nullable `schoolId` foreign key plus
an index. There is no ORM-level automatic tenant filter (no Postgres RLS
yet); instead, tenant isolation is enforced at the application layer by
convention-with-teeth:

- `src/lib/auth/require.ts` — `requireSchoolUser()` is the only sanctioned
  way a Server Action or Server Component reads "who is the current user,
  what school are they in." It throws if there's no session or no
  `schoolId`.
- `src/lib/services/*.ts` — every function that touches a tenant-owned model
  takes `schoolId` as a mandatory first argument and folds it into the
  Prisma `where` clause. There is no exported function that queries e.g.
  `Student` without a `schoolId` — a caller that forgets to pass it is a
  TypeScript error, not a runtime cross-tenant leak.

`User.schoolId` and `Role.schoolId` are nullable specifically to leave room
for a platform-level Super Admin (Phase 7) without a schema migration later;
nothing in Phase 1's UI creates or uses such a user yet.

## Auth & permissions

- **Auth.js v5**, credentials provider, bcrypt-hashed passwords (`src/auth.ts`).
  Session is a JWT carrying `userId`, `role` (key), `schoolId`.
- **Permissions** are `module.action` strings (`src/lib/permissions.ts`),
  e.g. `students.edit`, `staff.invite`, `school_settings.manage`,
  `attendance.mark`, `results.approve`, `finance.manage`, `expenses.approve`.
  The catalog only lists permissions for modules that actually exist —
  payroll permissions, for instance, aren't seeded ahead of time as inert
  placeholders.
- **Roles** (`Role` model) are tenant-scoped rows, not a global enum. When a
  school is created, `src/lib/school-provisioning.ts` seeds one `Role` row
  per system role (`SCHOOL_OWNER`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`,
  `ACCOUNTANT`, `HR_STAFF`, `LIBRARIAN`, `TRANSPORT_MANAGER`, `PARENT`,
  `STUDENT`) and copies the default permission matrix
  (`ROLE_DEFAULT_PERMISSIONS`) into that school's own `RolePermission` rows.
  This means a school's role → permission matrix is real, editable data —
  changing what a `TEACHER` can do at School A never touches School B — even
  though Phase 1 doesn't yet expose a UI to edit it (roles are fixed at
  creation time until that UI lands).
- **`ROLE_DEFAULT_PERMISSIONS` is only ever applied once, at that
  school-creation moment — which means a school provisioned before a later
  phase added a new default permission to one of its roles doesn't
  retroactively gain it.** This surfaced as a real bug: a school seeded
  early and never re-seeded got "Missing permission" errors on pages a
  later phase's default matrix says that role should reach. Rather than
  auto-granting on every request (expensive, and silently masks the gap),
  `prisma/scripts/backfill-permissions.ts` is a standalone, idempotent,
  additive-only script (`npm run db:backfill-permissions`) that tops up
  every school's system roles to the current defaults without touching real
  data — the fix for an existing database, the same way `npm run db:seed`
  is the fix for the demo school specifically. It's standalone (not
  imported from `school-provisioning.ts`) for the same `server-only`
  reason `prisma/seed/index.ts` is.
- **Enforcement is server-side only.** `requirePermission(key)` re-checks the
  database on every call (no caching across requests) so a permission change
  takes effect immediately rather than waiting out a session's JWT lifetime.
  Nothing in the UI hides an action as its only form of access control.
- **A page's own top-level gate must be its VIEW permission, never a
  narrower action permission — a real bug this repo shipped and then
  fixed.** `/dashboard/attendance` and `/dashboard/results` originally
  gated on `attendance.mark`/`results.enter` (what the entry form needs)
  instead of `attendance.view`/`results.view` (what merely opening the
  page needs), so a role like `PRINCIPAL` — real `attendance.view` and
  `results.view`, no marking/entry rights by design — got a hard 500
  instead of a read-only page. Fixed by gating the page on the VIEW
  permission and switching between the interactive form
  (`RosterForm`/`ScoreGridForm`) and a read-only render
  (`RosterReadOnly`/`ScoreGridReadOnly`) based on whether the signed-in
  user also holds the action permission — the Server Action behind the
  form still independently re-checks that action permission, so this is
  presentation, not the security boundary.
- **The sidebar (`src/components/dashboard/sidebar.tsx`) filters its own
  links by permission**, fetched once in `dashboard/layout.tsx`
  (`getUserPermissions`) and passed down as a plain string array (a Server
  Component can't hand a client component a `Set`). Each nav entry
  declares the same `PermissionKey` its target page's top-level
  `requirePermission()` call checks — kept in sync by hand, the same way
  the tool list in `src/lib/ai/tools.ts` mirrors dashboard permissions —
  so a role never sees a link that would 500 if clicked. This is on top
  of, not instead of, the page-level check: a crafted direct request to a
  hidden URL still gets a proper 500 from `requirePermission`, same as
  before.
- **Enrolling a student (`students.create`) is deliberately restricted to
  `SCHOOL_OWNER` and `PRINCIPAL` ("Head of School" — the role key stays
  `PRINCIPAL` in code/data; only its display label changed) — not even
  `SCHOOL_ADMIN` gets it by default.** `SCHOOL_ADMIN`'s permission set is
  otherwise "everything except `roles.manage`"
  (`ALL_PERMISSIONS.filter(...)` in `src/lib/permissions.ts`), so this is
  the one deliberate carve-out from that shortcut, not a separately
  maintained list. `/dashboard/students/new` gates on `students.create`
  (it previously only checked the user was signed in, relying on the
  Server Action alone — the same page-vs-action gap `attendance`/`results`
  had); the "Enroll a student" button/links on the students list and main
  dashboard are hidden without it, matching the sidebar's permission-aware
  pattern above.
- **`prisma/scripts/backfill-permissions.ts` syncs in both directions, not
  just additively.** It originally only granted permissions a role's
  current defaults included but the database didn't (see "Enforcement is
  server-side only" history above); restricting `students.create` away
  from `SCHOOL_ADMIN` needed the reverse too — revoking a permission a
  role used to default to but no longer does — so the script now diffs a
  role's current grants against `ROLE_DEFAULT_PERMISSIONS` and both grants
  what's missing and revokes what's no longer there. Still safe for the
  same reason as before: no role-editing UI exists yet, so there's no
  intentional per-school customization to lose.

## Data model

Core entities (`prisma/schema.prisma`):

- **Tenancy**: `School`, `Campus`
- **Identity**: `User`, `Role`, `Permission`, `RolePermission`, `StaffInvite`
- **Academics**: `AcademicSession`, `Term`, `Department`, `ClassGroup`,
  `ClassArm`, `Subject`, `TeacherAssignment`, `TimetableSlot`
- **Students**: `Student`, `Guardian`, `StudentGuardian`
- **Attendance**: `AttendanceRecord`
- **Assignments**: `Assignment`, `AssignmentSubmission`
- **Results**: `GradeBand`, `AssessmentComponent`, `Score`, `ReportCard`
- **Finance**: `FeeCategory`, `FeeStructure`, `Invoice`, `InvoiceItem`,
  `Payment`, `Vendor`, `ExpenseCategory`, `Expense`
- **Communication & portals**: `PortalInvite`, `Notification`, `Announcement`,
  `Conversation`, `Message`
- **AI assistant**: `AiConversation`, `AiMessage`
- **Audit**: `AuditLog`

`ClassGroup` is a grade level (e.g. "JSS1"); `ClassArm` is the stream
students actually enroll into (e.g. "JSS1 Blue"). This split existed from
Phase 1 specifically because Phase 2's timetable and results are per-arm,
not per-grade — it paid off without a migration.

`TeacherAssignment` (who teaches which subject to which class arm) is the
one piece of Phase 2 that everything else leans on: it's not enforced as a
hard row-level restriction yet (anyone holding `attendance.mark` can mark
any class, matching how `students.edit` already worked in Phase 1 — a
role-level permission, not a per-record ownership check), but the data
exists so a future tightening to "only your own classes" is a query change,
not a schema change.

`ReportCard` deliberately stores only the human workflow state (`status`,
`approvedById`/`approvedAt`, `publishedAt`, comments) — subject totals,
grades, and class position are always recomputed from live `Score` rows at
read time (`computeReportCard` in `src/lib/services/results.ts`), so a late
score correction is reflected immediately everywhere the report card is
shown or downloaded, with nothing to invalidate or go stale.

## Onboarding

`src/app/onboarding/*` walks: create account (`/register`, creates `School`
+ owner `User` in one transaction) → school info → academic structure
(one session, auto-split into three terms, plus classes/arms/subjects) →
invite staff. `School` carries `*CompletedAt` timestamps per step, so
`nextOnboardingStep()` (`src/lib/services/school.ts`) can resume a partially
onboarded school and the dashboard layout redirects back to onboarding until
it's done. CSV import and fee/grading configuration are intentionally not
part of this wizard yet — they're real Phase 2/3 features, not stubbed.

## Phase 2: academics

- **Attendance** — one `AttendanceRecord` per student per calendar day
  (`@@unique([studentId, date])`), so re-marking a day upserts rather than
  duplicating. `AttendanceMethod` is an enum with only `MANUAL` implemented
  (`QR`/`BIOMETRIC` exist as schema-level extensibility per the brief, not
  as working features) — a school-wide "% present today" figure on the
  dashboard is a live aggregate, not a cached number.
- **Timetable** — `TimetableSlot.startTime`/`endTime` are plain `"HH:mm"`
  strings rather than `DateTime`, since a slot repeats weekly with no fixed
  calendar date; conflict detection (`createTimetableSlot` in
  `src/lib/services/timetable.ts`) does a string-range overlap check against
  both the class and the teacher before allowing a new slot, server-side —
  there's no drag-and-drop or AI generation yet, just validated CRUD.
- **Assignments** — creating one seeds an `AssignmentSubmission` row per
  active student in the class immediately, because there's no student
  portal yet (Phase 4) for self-service submission; a teacher's gradebook
  view is really "record what was handed in and grade it," not a real
  submission inbox. That will change once students can log in themselves.
- **Results** — `AssessmentComponent` (e.g. "1st CA" /20, "Exam" /60) and
  `GradeBand` (e.g. 70–100 → "A") are per-school, editable data, seeded with
  sensible Nigerian-curriculum defaults at school creation
  (`school-provisioning.ts`) so score entry works immediately without a
  required setup step. The report card workflow enforces the brief's
  human-in-the-loop rule at the permission level, not just in the UI: a
  forged `principalComment` form field from a `TEACHER` session is silently
  dropped server-side (`updateCommentsAction` checks `results.approve`
  itself, independent of which fields the UI rendered for that user), and
  `publishReportCard` refuses to run unless the row is already `APPROVED`.
  Report card PDFs (`src/lib/services/report-card-pdf.ts`) reuse the same
  pdfkit pattern the marketplace app uses for invoices.

## Phase 3: finance

- **Money** is always an integer in the school's currency's minor units
  (kobo for NGN) — never a float — via `amountMinor` columns everywhere and
  a single `formatMoney()`/`toMinorUnits()` pair (`src/lib/money.ts`) that's
  the only place a conversion to/from a display value happens.
- **Fee structures → invoices** — `FeeStructure` rows are school-configured
  data (category, optional class-group scope, term, amount).
  `generateInvoicesForClass` (`src/lib/services/invoices.ts`) rolls every
  structure applicable to a class (matching its class group, or scoped to
  "all classes") into one `Invoice` + one `InvoiceItem` per structure, per
  active student, skipping students who already have one for that term.
- **Invoice status is derived, never set directly.** `recalculateInvoiceStatus`
  sums confirmed `Payment` rows against `totalMinor` and writes
  `ISSUED`/`PARTIALLY_PAID`/`PAID` every time a payment is recorded or
  confirmed — no code path sets `Invoice.status` any other way, so it can't
  drift from what's actually been paid.
- **Payment provider abstraction** (`src/lib/payments/`) — `PaymentProvider`
  is an interface (`initialize`, `verify`); `mock-provider.ts` implements it
  without any external credentials by redirecting to the app's own
  confirmation page instead of a real gateway's checkout, and `registry.ts`
  selects an implementation via `PAYMENT_PROVIDER` (default `mock`). A real
  adapter (Paystack, Flutterwave, ...) is a new file plus a registry entry —
  nothing that calls `getPaymentProvider()` changes.
- **No parent portal yet (Phase 4), so `Invoice.payToken`** is what makes
  "online payments" and "bank transfers" reachable at all in this phase: an
  unauthenticated `/pay/[token]` page (same unguessable-token pattern as the
  Phase 1 staff-invite link) lets a parent view the invoice, pay through the
  mock provider, or see the school's bank details and record a "notify
  transfer" `PENDING` payment for staff to confirm from the invoice detail
  page. Receipts for confirmed payments are downloadable the same way
  (`/api/pay/[token]/receipt/[paymentId]`), no login required.
- **Expense approval is threshold-based, not universal.** `recordExpense`
  checks the amount against the school's configurable
  `expenseApprovalThresholdMinor` at creation time — anything under it is
  auto-`APPROVED`, only amounts at or above it land as `PENDING` for an
  owner/admin, matching the brief's "expenses above ₦X require approval"
  rather than gating every expense on a human.

## Phase 4: communication & portals

- **Every tenant-owned table carries a direct `schoolId`, no exceptions —
  learned the hard way.** `Message` was first modeled without one (reachable
  only via `Conversation.schoolId`, one hop further from `School` than every
  sibling table). Reseeding hit a real Postgres foreign-key ordering bug: on
  `DELETE FROM "School"`, the cascade to `User` (one hop) and the cascade to
  `Message` (two hops, via `Conversation`) aren't guaranteed to interleave
  correctly, so `Message_senderId_fkey` (`ON DELETE RESTRICT`, like every
  other `User` reference in this schema) fired before the `Message` row was
  gone. Giving `Message` its own `schoolId` — matching every other model —
  fixed it and restored the one-hop-from-`School` invariant the rest of the
  schema already relied on.
- **Portal accounts are opt-in, not automatic.** Enrolling a student or
  adding a guardian does not create them a login — a `PortalInvite` link
  (`src/lib/services/portal-invites.ts`) does, generalizing the exact
  `StaffInvite` token-accept pattern from Phase 1 (`/portal-invite/[token]`,
  same unguessable-token, same "set your name and password" accept form).
  `Guardian.userId`/`Student.userId` stay null until that invite is
  accepted, so most students in a freshly onboarded school have no portal
  presence at all, which is the expected/common case, not an error state.
- **Notifications are in-app only, and derived from real events, never
  synthesized.** `src/lib/services/notifications.ts` is called from inside
  the exact service functions that already do the work — `publishReportCard`,
  `generateInvoicesForClass`, all three payment-confirmation paths in
  `payments.ts`, and `markAttendance` when a status is `ABSENT` — never from
  a scheduled job or a guess at what "should" have happened. Email/SMS/
  WhatsApp/push are schema-level extensibility only (no provider is wired
  up), matching the Phase 2 `AttendanceMethod.QR`/`BIOMETRIC` precedent: the
  `NotificationType` enum and the `Notification` model don't claim a
  delivery channel that doesn't exist.
- **Announcements resolve their own recipient list per audience at publish
  time** (`src/lib/services/announcements.ts`) — `STAFF_ONLY` queries every
  user whose role key isn't `PARENT`/`STUDENT`; `PARENTS_ONLY` and `CLASS`
  walk `Guardian`/`Student` rows with `userId` set; `SCHOOL_WIDE` unions all
  of the above. This runs fresh on every publish rather than snapshotting a
  recipient list at creation time, so an announcement drafted before a
  parent's portal invite was accepted still reaches them once they've
  accepted it, as long as it's published after.
- **Messaging is a shared admin-office inbox, not per-staff assignment.**
  `Conversation.initiatedById` is always the parent/student who started it;
  there is no "assigned to" field. `notifyNewMessage` looks up *who currently
  holds* `messages.view` for the school at the time of the message (a live
  permission query, not a cached list), so it stays correct if a school
  changes its own role/permission matrix later — the same "no caching across
  requests" principle `requirePermission` already uses.
- **Portals reuse compute functions, they don't reimplement them.** The
  parent portal's per-child view (`/portal/parent/children/[studentId]`) and
  the student portal's own pages call `computeReportCard`,
  `getStudentAttendanceHistory`, `listSlotsForClassArm`, and
  `listInvoicesForStudent` — the exact same functions the staff dashboard
  calls for the same data — so a late score correction or a newly confirmed
  payment shows up identically on both sides with nothing to keep in sync.
  Two access-control helpers make this safe: `getChildForGuardian` verifies
  the requested student is actually one of the signed-in guardian's children
  before returning anything (a parent can't view another family's child by
  guessing an id in the URL), and `/api/report-cards/[studentId]/pdf` was
  extended to accept either staff holding `results.view` *or* a portal user
  requesting their own record/child, since `PARENT`/`STUDENT` roles
  intentionally carry no staff permissions at all.
- **Fee payment in the parent portal reuses the Phase 3 `/pay/[token]` link
  as-is** rather than building a second, authenticated payment path — each
  invoice already carries an unguessable `payToken`; the parent portal just
  surfaces it as a link on each invoice row instead of it only being
  reachable by an unauthenticated payer who was sent the link separately.

## Phase 5: AI assistant

```
Chat message → provider.generate() → tool_calls? → permission check → tool.execute() → audit log
                       ↑__________________________________________________|
                       (results fed back for the next round, or a final text reply)
```

- **No mock AI provider — this is the one place the mock-adapter pattern
  from payments deliberately doesn't apply.** `src/lib/payments/mock-provider.ts`
  is honest about not being a real gateway (it just redirects to the app's
  own confirmation page); there's no equivalent honest stand-in for "a real
  answer" — a scripted response IS a fake answer. So
  `src/lib/ai/providers/registry.ts`'s `getAiProvider()` returns `null` when
  neither `OPENAI_API_KEY` nor `ANTHROPIC_API_KEY` is set, and every caller
  (the assistant pages, `sendMessage`) treats that as "not configured," not
  as a reason to fabricate a reply. This was verified in this environment
  (no API key available) with a throwaway scripted provider that was never
  committed — see the note below.
- **Every tool is permission-gated twice, not once.** `src/lib/ai/tools.ts`
  pairs each tool with the exact `PermissionKey` its dashboard equivalent
  requires (`get_student_fees` needs `finance.view`, `mark_student_attendance`
  needs `attendance.mark`, ...). `getToolsForPermissions()` filters the tool
  list the model even sees down to what the signed-in user can do — a
  teacher's tool list has no finance tools in it at all — and
  `sendMessage`/`confirmToolCall` re-check the same permission again before
  calling `execute()`, so a model that somehow named a tool it wasn't shown
  still can't run it. This is the same "belt and suspenders" pattern as
  `updateReportCardComments` re-checking `results.approve` server-side
  instead of trusting which fields the UI rendered.
- **Read tools execute inline; the one write tool waits for a human.**
  `AiTool.kind` is `"read"` or `"write"`. A read tool's result is computed
  and stored in the same turn the model asks for it. `mark_student_attendance`
  (`kind: "write"`) is the only exception in this phase — its `AiMessage` row
  is written with `toolStatus: "PROPOSED"` and `sendMessage` stops there,
  returning `pendingConfirmation: true`; nothing runs until the signed-in
  user calls `confirmToolCall` (or `declineToolCall`) from the confirmation
  card in the UI. This mirrors the report card `DRAFT → APPROVED → PUBLISHED`
  gate: the model can *propose* a change, never *make* one unattended.
- **Every executed tool call — read or write — is written to `AuditLog`**
  (`action: "ai.tool_call"`, `resourceType` the tool's name, `newValue` the
  arguments and result), from the same `logAudit()` helper every other
  mutation in the app uses. A declined write leaves no audit row, since
  nothing happened.
- **Conversation history round-trips through Postgres, not memory.**
  `AiConversation`/`AiMessage` store every turn, including tool calls and
  their results, so `rowsToChatMessages()` (`src/lib/services/ai-assistant.ts`)
  can reconstruct the exact message sequence both providers require on
  every call — a synthesized assistant "tool_calls" message immediately
  followed by one tool-result message per call — rather than trusting
  anything held in a request-scoped variable. This is also what makes
  `confirmToolCall` work as a separate request from the one that proposed
  the action: it reloads history, doesn't resume in-memory state.
- **Verified without a live API key.** This environment has neither
  `OPENAI_API_KEY` nor `ANTHROPIC_API_KEY` set, so the real
  `sendMessage`/`confirmToolCall` loop was exercised end-to-end using a
  small scripted provider (fixed tool-call sequence, no model, never
  imported by `registry.ts`) wired in only long enough to prove the
  history-reconstruction, confirm/decline, and audit-logging code paths
  work — then removed before this was committed. Every tool's `execute()`
  was also run directly against the seeded database (find a student, pull
  their attendance/results/fees, mark attendance, hit a bad id) and checked
  against real rows. What's *not* verified here is an actual model choosing
  the right tool from natural language — that depends on a real provider key,
  which this environment doesn't have.

## Testing tenant isolation

Still not automated (no test suite exists for this app yet — `vitest` is
wired up in `package.json` but empty; Phases 1 through 5 were each verified
manually end-to-end against a real database instead). The service-layer
pattern above (`schoolId` as a mandatory first argument everywhere) is the
structural mitigation in place; a "School A cannot read School B's students
(or invoices, or payments, or portal invites, or messages, or AI
conversations)" integration test, per the brief's testing requirements, is
overdue and should not be deferred again — it's the highest-value thing to
add before Phase 6.

## UX pass: pagination, mobile navigation, responsive layout

Every list page that can grow unbounded is now paginated with a consistent
`page`/`pageSize` pattern (skip/take + a parallel `count`, 20 rows per page):
students, staff, assignments, invoices, expenses, announcements (dashboard
and both portal variants), messages (dashboard and parent portal), and AI
assistant conversations. Each service function returns
`{ items, total, page, pageCount }`; each page component reads `page` from
`searchParams` and renders the shared `<Pagination>` component
(`src/components/ui/pagination.tsx`), which windows page numbers (`1 … 4 5 6
… 20`) and renders nothing when `pageCount <= 1`. `fee-structures.ts` and
`teacher-assignments.ts` were deliberately left unpaginated — both are
bounded, slowly-growing configuration lists (comparable to grading setup),
not the kind of list that grows with school size.

Mobile navigation was a real functional gap, not just cosmetic: the
dashboard `Sidebar` and portal `PortalSidebar` are both `hidden md:flex`
with no fallback, so below the `md` breakpoint there was previously no way
to navigate the app at all. `src/components/ui/nav-drawer.tsx` adds a
`NavDrawer` primitive (hamburger trigger + slide-out drawer, both in one
client component so open/close state doesn't need to be lifted into the
server-rendered layout) that `DashboardMobileNav` and `PortalMobileNav`
wrap with the same nav lists their desktop siblings use (the dashboard
variant applies the same permission filtering as `Sidebar`). The trigger is
rendered into `DashboardTopbar`'s left slot via a new `mobileNav` prop, not
nested inside the desktop sidebar's `hidden` aside — otherwise it would
inherit `display: none` on mobile too. The drawer closes via each link's own
`onClick`, not a `pathname`-watching effect — this repo's lint config
(`react-hooks/set-state-in-effect`, `react-hooks/refs`) rejects both the
effect-based and the ref-during-render patterns for "close on navigation",
so per-link `onClick={() => setOpen(false)}` is the pattern to reuse for any
future drawer/modal that needs the same behavior.

Fixing mobile nav surfaced a real layout bug: on narrow viewports, tables
and other wide content were forcing the *entire page* to scroll
horizontally instead of scrolling within their own `overflow-x-auto`
container. Root cause: `.container-shell` (the page-content wrapper) centers
itself with `margin-left/right: auto` but had no explicit `width`. A
`margin: auto` flex item with `width: auto` doesn't stretch to fill its
flex container's cross-axis — the browser sizes it to its content's
max-content width instead, which is exactly the CSS flexbox rule "auto
margins absorb positive free space and disable stretch alignment on that
axis." Fixed by adding `width: 100%` to `.container-shell` — it still caps
at `max-width: 84rem` and centers via the auto margins on wide screens
(verified: unchanged at a 1920px viewport), but on narrow screens it now
correctly resolves to 100% of the available flex width instead of
ballooning to fit its content. `min-w-0` was also added to the intervening
flex containers (`dashboard/layout.tsx` and both portal layouts) as
defense in depth, though the `width: 100%` fix was the one that mattered.
Page headers with a title + primary action button
(`flex items-center justify-between`) were changed to
`flex flex-wrap items-center justify-between gap-3` so the button drops
below the title on narrow screens instead of being squeezed or clipped.

## Phase 6: advanced ERP (payroll, library, transport, hostel)

Four independent modules, each with its own schema slice, `module.action`
permissions, and `/dashboard/<module>` pages — none of them depend on each
other, so they're described separately.

**Payroll.** `SalaryComponent` is a per-school catalog of earning/deduction
line items (mirrors `FeeCategory` on the finance side). `StaffSalaryStructure`
+ `StaffSalaryItem` hold one staff member's current pay structure. A
`PayrollRun` (unique per `schoolId`+month+year) generates one `Payslip` per
staff member who has a structure configured, **snapshotting** their
`StaffSalaryItem` rows into `Payslip.items` (a JSON array) at generation
time — editing a structure or the component catalog afterward never changes
an already-generated payslip, only future runs. A run only regenerates while
`DRAFT` (re-running replaces its payslips wholesale, e.g. after fixing a
structure or onboarding a new staff member); `payroll.approve` moves it
`DRAFT → APPROVED → PAID`, each step one-way. `payroll.view` is broad
(Owner, Admin, Head of School, Accountant, HR); `payroll.manage` (build
structures, generate runs) sits with Accountant and HR — realistic for a
small school where either might run payroll — while `payroll.approve` stays
with Owner/Admin/Head of School, the same separation-of-duties shape as
`expenses.approve`.

**Library.** `Book.totalCopies` is the only stock number stored;
`availableCopies` is always derived (`totalCopies` minus currently-`ISSUED`
`BookLoan` rows) rather than duplicated, so it can't drift the way a
manually-decremented counter could. A loan's borrower is either a `Student`
or a staff `User` (`borrowerStudentId`/`borrowerUserId`, exactly one set) —
checked in `src/lib/services/library.ts`, not a DB constraint, the same
application-layer-invariant pattern used elsewhere in this schema (e.g.
`Expense.vendorId` being optional). `LIBRARIAN` (a system role seeded since
Phase 1 but unused until now) gets `library.view`+`library.manage`.

**Transport.** `Vehicle` → `TransportRoute` (optional vehicle assignment) →
`RouteStop` (ordered, with optional pickup/drop-off times) →
`StudentTransportAssignment`. Assigning a student to a route ends their
existing active assignment first (`endedAt` set) — one active assignment per
student, enforced in `src/lib/services/transport.ts` rather than a DB
constraint, since Postgres/Prisma can't express "at most one row with
`endedAt IS NULL` per student" as a simple unique index. `TRANSPORT_MANAGER`
(also seeded since Phase 1, also unused until now) gets
`transport.view`+`transport.manage`.

**Hostel.** `Hostel` → `HostelRoom` (fixed `capacity`) →
`HostelBedAssignment`, the same one-active-assignment-per-student pattern as
transport, plus a capacity check (`assignStudentToRoom` throws if the room
is already full — computed from the active-assignment count, not a stored
counter, same derived-not-duplicated reasoning as library availability). No
system role was pre-seeded for hostel management (unlike Librarian/Transport
Manager) — `hostel.view`+`hostel.manage` went to `HR_STAFF` instead, since
boarding administration is realistically an HR/admin function at a small
school, not one that warranted reserving a dedicated role since Phase 1.

**Shared decisions across all four:** dropdown pickers for a book's borrower
or a route/room assignment use unpaginated "brief" list functions
(`listAllStaff`, `listActiveStudentsBrief`) rather than the paginated
directory queries — same reasoning as the `classArmId` filter dropdown on
the students page: a school's population is bounded, so a `<select>` with
every option is simpler and fine, while the *tables* that render that same
population (students list, staff list, payroll runs, book loans) stay
paginated. The seed script and `backfill-permissions.ts` both had to
duplicate the payroll snapshot/component logic directly against
`PrismaClient` rather than importing from `src/lib/services/payroll.ts`, for
the same `import "server-only"` constraint documented above for finance/
Phase 4 seeding.

## Phase 7: SaaS billing & platform admin

The last content phase — this one is about Schoolum-the-company billing
*schools* for using the platform, a completely different thing from every
other finance-shaped model in this schema, which bills a *student's family*
for school fees. `SubscriptionPlan`/`Subscription`/`PlatformInvoice` carry
no relation to `FeeStructure`/`Invoice`/`Payment` at all.

**The Super Admin role is structurally different from every tenant role.**
It's a single global `User` row (`schoolId: null`) pointing at a single
global `Role` row (`schoolId: null`, `key: "SUPER_ADMIN"`) that is
deliberately *not* part of `SYSTEM_ROLE_KEYS`/`ROLE_DEFAULT_PERMISSIONS` —
those are reseeded fresh per school; this one is seeded exactly once,
platform-wide. Access to `/platform/*` is checked directly against the
session's role key (`requireSuperAdmin()` in `src/lib/auth/require.ts`)
rather than through `RolePermission`, because "does this role have
`students.view`" is a meaningless question for an account that isn't
scoped to any school's data. Bootstrapping one is deliberately not
self-serve — `npm run platform:create-admin -- --email=... --password=...`
(a standalone script, same `import "server-only"` constraint as
`backfill-permissions.ts`) is the only way, run once per environment.
`dashboard/layout.tsx` checks for this role *before* calling
`requireSchoolUser()` (which would otherwise throw for it — a Super Admin
has no `schoolId` by design) and redirects to `/platform`; `middleware.ts`
protects `/platform/*` the same way it does `/dashboard`, `/portal` and
`/onboarding`.

**`School.status` (TRIAL/ACTIVE/SUSPENDED) and `Subscription.status`
(TRIALING/ACTIVE/PAST_DUE/CANCELED) are deliberately two separate fields,**
not one. The first is an account-access flag a Super Admin sets
independently of payment — a school can be suspended for a ToS issue while
still current on its subscription, or vice versa. Collapsing these into one
status would eventually force a workaround for exactly that case.

**`createSchoolWithOwner`** (the `/register` signup flow) now also enrolls
every new school on a trial subscription — originally the `Starter` plan
with a 30-day period; see "Subscription & billing system" below for the
current shape (a 14-day, Professional-tier trial) — `ensureDefaultPlans()`
in
`src/lib/platform-provisioning.ts` is called before creating the tenant,
the same "idempotent upsert, safe to call every time" shape as
`ensurePermissionCatalog()`. This only applies going forward: a school
created before this code existed has no `Subscription` row at all, which
the schools list/detail pages render as a real, handled state (a `—` plan
column, an empty-state card) rather than crashing — and
`createSubscriptionForSchool()` gives a Super Admin a real way to onboard
one from the UI rather than that being a dead end. `billing.view`/
`billing.manage` (the school's own `/dashboard/billing`) are owner-only by
default, carved out of `SCHOOL_ADMIN`'s `ALL_PERMISSIONS` shortcut the same
way `students.create`/`roles.manage` are — a school's relationship with the
platform is more sensitive than its own internal finance module.

## Subscription & billing system

Phase 7 above laid the schema/Super-Admin foundation; this is a full
rebuild on top of it into an actually plan-enforcing, self-serve, payable
subscription system — four real-priced tiers, a centralized entitlement
gate, self-serve upgrade/downgrade, and Schoolum's own payment collection
from schools, not just a Super Admin's manual dashboard.

**Pricing/limits/features live in one place** —
`src/lib/billing/plan-catalog.ts` (`PLAN_CATALOG`) and
`src/lib/billing/features.ts` (`FEATURE_CATALOG` +
`PLAN_TIER_DEFAULT_FEATURES`) — and only *seed* the database
(`ensureDefaultPlans()`, `prisma/seed`); every runtime read goes through
`SubscriptionPlan` rows via `listPlans()`, so a Super Admin can edit a
live price or flip one feature per plan at `/platform/plans` without a
deploy. This deliberately mirrors `PERMISSIONS`/`PERMISSION_CATALOG`/
`RolePermission`'s exact shape: a fixed catalog in code, a database table
that's the actual runtime source of truth.

**`src/lib/billing/entitlements.ts` is the single server-side gate.**
`hasFeature`/`requireFeature` and `getStudentLimit`/`requireStudentCapacity`
are the only functions anything else calls to ask "is this school entitled"
— never a scattered `if (plan === "professional")`. The two fail in
opposite directions on purpose: a school with no `Subscription` row at all
(legacy, or a broken provisioning state) is fail-*open* for student
capacity (an operational gap to fix, not a reason to suddenly block
enrollment) but fail-*closed* for premium features (safety default). The
one real choke point for the limit is `createStudent()` in
`src/lib/services/students.ts` — admission's `admitApplicant` goes through
the same function rather than re-implementing the check.

**Lazy status reconciliation, not a cron job.** This app has no background
job runner, so `TRIALING → EXPIRED`, `ACTIVE → PAST_DUE` (grace period
starts) and `PAST_DUE → EXPIRED` are computed — and persisted — the next
time anything calls `getEffectiveSubscription()`, not on a schedule. It
only ever moves a subscription *toward* restricted access as time passes;
it never reverses a Super Admin's own manual status change (`CANCELED`/
`SUSPENDED` are untouched). The two transitions that represent a real,
one-time event (`TRIALING → EXPIRED`, `ACTIVE → PAST_DUE`) also fire a
notification from inside `reconcile()` itself — safe to do because the
`WHERE status = <old status>` shape of the branch means it can only match
once per actual transition, not on every subsequent read.

**Self-serve billing (`/dashboard/billing`,
`src/lib/services/billing.ts`)** — `changePlanSelfServe` applies a plan/
interval change immediately in both directions, no proration; a downgrade
that would drop the school under its current active-student count is
refused outright (`DowngradeBlockedError`) rather than silently archiving
anyone, and student data is never touched by any plan change, cancellation,
or expiry — only `Subscription`/`PlatformInvoice` rows move. Changing plan
voids any still-outstanding `PENDING` invoice before creating the new
period's invoice, so a school never ends up with two open invoices for
different prices.

**Schools pay Schoolum through the same `PaymentProvider` abstraction**
the parent-facing gateways use (`src/lib/payments/types.ts`) — but resolved
against Schoolum's *own* Paystack keys
(`src/lib/billing/payment-provider.ts`, `PLATFORM_PAYSTACK_SECRET_KEY`/
`PLATFORM_PAYSTACK_PUBLIC_KEY`), never a school's own
`PaymentGatewayCredential` rows, which exist for the opposite direction
(a school collecting fees from its parents). Unset in dev — falls back to
a simulated checkout (`/dashboard/billing/confirm`), same principle as
every other payment flow in this app requiring zero setup to demo.
`/api/webhooks/platform-paystack` is the school-pays-Schoolum counterpart
to `/api/webhooks/{paystack,flutterwave,korapay}` — signed against one
platform-wide secret (not a per-school lookup, since there's exactly one
merchant account on this side) and idempotent via `BillingEvent`'s
`@@unique([provider, externalEventId])`, which doubles as an audit log:
every delivery is recorded (`RECEIVED` → `PROCESSED`/`IGNORED`/`FAILED`),
including ones that don't match a known invoice.

**Real data only, everywhere.** `/platform/billing` (MRR/ARR/plan mix/
churn/expiring trials/overdue invoices) and `/pricing`'s comparison table
are both computed from the live database — nothing here is a hardcoded or
synthetic figure. Churn is deliberately narrow rather than approximate-but-
wrong: only `CANCELED` subscriptions have a precise timestamp
(`canceledAt`) to window against; a lazily-reconciled `EXPIRED` transition
doesn't record *when* it happened, so it's excluded from the 30-day figure
rather than guessed at.

**Enterprise inquiries never auto-create a subscription.** The pricing
page's "Let's build a plan for your school" form
(`src/app/pricing/enterprise-form.tsx`) writes one `EnterpriseInquiry` row
— reviewed and actioned by a human at `/platform/inquiries`
(`markEnterpriseInquiryReviewed`), never wired to provision anything on
its own.

**Testing (`npm test`, vitest)** hits the real database directly — there's
no mocking layer anywhere else in this codebase, so the test suite doesn't
invent one either. `server-only` (which unconditionally throws under plain
Node/vitest, not just under a bare `tsx` run — confirmed the same way
`prisma/seed` already had to work around it) is aliased to an empty stub
in `vitest.config.ts` so tests can import the real service modules
unmodified, rather than duplicating their logic. Every fixture school gets
a `vitest-`-prefixed slug and is deleted in `afterAll`; `fileParallelism:
false` is required precisely because that cleanup is a blanket
prefix-delete — a concurrently-running file's still-in-progress fixtures
would otherwise get deleted out from under it.

## Administration: nested navigation, admission, calendar, feedback

The sidebar moved from a flat list to arbitrary-depth nested groups,
modelled on a reference school-management system's IA. `NavItem` (`src/components/ui/nav-tree.tsx`)
is either a leaf (`href`) or a group (`children`, no `href`); `NavTree` renders
both recursively and is shared, unchanged, by all three sidebars
(dashboard, portal, platform) and their mobile drawer counterparts via
`NavDrawer` — one component owns "does this route make the group open,"
so the desktop and mobile nav can never drift out of sync. A group
auto-expands if the active route is inside it and otherwise stays exactly
as the user last toggled it (local `useState<Set<string>>`, not derived
from the route on every render). Permission filtering happens *before*
items reach `NavTree`: `filterNav()` in `sidebar.tsx` walks the tree,
drops any leaf whose `requiredPermission` the user lacks, and drops a
group once filtering empties out its children — `NavTree` itself has no
concept of permissions at all, keeping the two concerns separate. As
before, this is a UX layer only; every route it hides is independently
enforced server-side by `requirePermission()`.

**Administration** is the first nested group built out, with four
children: User (enhancements to existing staff management — Reset
Password and an All-Users directory across every role, portal accounts
included), Admission, Calendar and Feedback. Seven new permission keys
(`users.manage`, `admission.view`/`admission.manage`,
`calendar.view`/`calendar.manage`, `feedback.view`/`feedback.manage`) slot
into the existing `module.action` scheme; `HR_STAFF` — the role Schoolum
labels "HR / Admin Staff" — picks up the broadest set of them by default,
matching its purpose.

**Calendar** (`CalendarEvent`) has no `isArchived` flag. Archived is
computed at query time (`endAt < now()`), the same "derive, don't
duplicate" choice already used for `Book.availableCopies` — a manual flag
can drift from reality; a computed one cannot. `sessionId` on an event is
derived server-side from whichever `termId` was chosen, so the create/edit
form only exposes one dropdown, not two that could disagree.

**Feedback** is deliberately simple per the brief actually shipped
(general suggestions, not a complaints/ticket system): free text plus a
two-state `NEW`/`REVIEWED` status, no assignment or threading. Anyone
signed in — staff, parent or student — can submit
(`requireSchoolUser()`, not a `feedback.*` permission, since submitting
isn't an administrative act); only `feedback.manage` can mark one
reviewed. One `SubmitFeedbackForm` component is imported across three
route groups (dashboard, parent portal, student portal) rather than
duplicated three times.

**Admission** is the most involved of the four, because it was scoped to
support *both* public online applications and staff-entered ones rather
than picking one. `Applicant` is deliberately a separate model from
`Student`, not a `Student` with a draft status — an applicant who is
rejected, or who never completes the process, should never appear
anywhere a real enrolled student would (attendance, results, invoices).
The public, unauthenticated flow lives at `/apply/[slug]` (keyed by the
school's slug, the same pattern already used for `/pay/[token]` and
`/portal-invite/[token]`) and reuses that flow's shape closely: a
`submitApplication()` service call redirects to
`/apply/[slug]/[applicantId]`, which — if `School.admissionFeeMinor` is
set — offers a bank-transfer "I've made this transfer" button
(`markApplicationFeePendingConfirmation`) built on the exact same
`action.bind(null, id)` + `useActionState` pattern `PayOnlineButton`
already established, rather than inventing a second one. Staff then
confirm receipt (`confirmApplicationFeePaid`) from the applicant detail
page. `admissionFeeMinor` is snapshotted onto the `Applicant` row at
submission time — a school raising or lowering its fee later must never
silently rewrite the amount an in-flight applicant already agreed to pay.

The pipeline itself is a small explicit state machine
(`APPLIED → UNDER_REVIEW → OFFERED → ACCEPTED/REJECTED`) enforced in
`updateApplicantStatus()`, not left to the UI to get right. "Full
Admission Process" — converting an `ACCEPTED` applicant into a real
`Student` — calls `createStudent()`, the exact same function real
enrollment uses, so admission-number generation and guardian creation
can't drift between the two paths; the applicant is then stamped
`ENROLLED` and linked via `Applicant.enrolledStudentId` (a `@unique`
FK), so a second attempt to admit the same applicant is a guaranteed,
not just conventional, error.

## Multi-provider payments & portal branding

Two related, separately-toggleable capabilities: schools bring their own
online payment gateway (instead of the platform running one shared
gateway for everyone), and schools can make their dashboard/portal/public
pages look like their own school rather than Schoolum's demo styling.

**Why per-school gateway credentials, not a platform-wide `PAYMENT_PROVIDER`
env var.** The brief change here is a real shift: the original Phase 3
design had one process-wide payment provider (`PAYMENT_PROVIDER=mock`,
selected once for the whole deployment) that every school's invoices ran
through. That doesn't fit a real SaaS — each school has its *own*
merchant relationship with Paystack/Flutterwave/Korapay and needs the
money to land in *their* account, not a shared platform account. So
`getPaymentProvider()` is gone; `resolvePaymentProvider(schoolId)` in
`src/lib/payments/registry.ts` replaces it, reading
`School.activePaymentProvider` and that school's own
`PaymentGatewayCredential` row. A school with nothing connected still
gets a fully working "Pay online" button — it transparently falls back
to the same built-in mock/simulated gateway Phase 3 always had — so
connecting a real gateway is purely additive, never a precondition for
the rest of the app to work (matches the AI assistant's "no key set,
say so plainly" philosophy from Phase 5, just phrased as a fallback
instead of a blocked feature).

**Secrets are encrypted at rest, never displayed again.** A gateway's
secret API key is encrypted (`src/lib/crypto.ts`, AES-256-GCM, key
derived from `PAYMENT_KEYS_SECRET`, falling back to `AUTH_SECRET` so
local dev needs no extra setup) before it touches the database — the
public key is stored in the clear, since gateways treat it as safe to
expose client-side anyway. The settings form never re-populates a saved
secret key field; leaving it blank on an update keeps the existing one,
the same "don't re-ask for what you already have" pattern a real
payment dashboard uses. `payment_gateways.manage` is owner-only,
carved out of `SCHOOL_ADMIN`'s `ALL_PERMISSIONS` shortcut the same way
`billing.view` is — these are live keys that redirect where a school's
money goes, at least as sensitive as its platform billing relationship.

**One `Payment.provider` field turns "was this real or simulated" into a
stored fact, not an inference.** Set when a payment is initiated (from
whatever `resolvePaymentProvider` resolved *at that moment*), it's what
the confirm page branches on — a real gateway has already charged (or
declined) the card by the time the payer is redirected back, so that
page calls `provider.verify()` server-side and shows the outcome
immediately; the mock gateway has nothing to verify against, so it keeps
Phase 3's original "click to simulate paying" button. Critically,
confirming a payment re-resolves credentials by the specific provider
*that payment* recorded, not whatever the school's active provider
happens to be *now* — so a school switching gateways mid-flight can
never strand an in-progress payment. The same reference-based,
verify-before-trust design is mirrored for the admission application fee
(`Applicant.feePaymentReference`/`feePaymentProvider`), which has no
`Invoice` to hang a `Payment` row off, so it tracks the same two fields
directly on `Applicant` instead of joining through one. Webhook
endpoints (`/api/webhooks/{paystack,flutterwave,korapay}`) exist as a
defense-in-depth confirmation path — each verifies the gateway's own
signature scheme (HMAC-over-body for Paystack/Korapay,
a shared secret-hash comparison for Flutterwave, which doesn't sign the
body at all) before calling the same idempotent confirm functions the
redirect-based flow uses, so a webhook arriving before, after, or
instead of the payer's redirect is never a double-charge risk.

**Branding reuses the CSS custom properties already there, never a
per-school Tailwind rebuild.** `--accent`/`--accent-soft`/
`--accent-foreground` already drive every button, badge, link and active
nav state in `globals.css`; `src/components/brand/brand-style.tsx`
recomputes those three values from one school-chosen hex
(`src/lib/color.ts` — a soft tint mixed toward white, and a black-or-white
foreground picked by WCAG relative luminance so an arbitrary brand color
never picks an unreadable text color) and overrides them with an inline
`<style>` tag mounted once per school-facing layout. Nothing below that
layout needs to know branding exists. It's deliberately scoped to
tenant-facing surfaces only — dashboard, parent/student portal, and the
public `/apply/[slug]` and `/pay/[token]` pages (each via its own nested
layout, since those routes need the school resolved from a slug/token
before they can brand anything) — never the login/register/onboarding
pages or `/platform`, which are Schoolum's own product chrome, not any
one school's. `<SchoolLogo>` is `<Logo>`'s tenant-branded counterpart:
an uploaded image if `School.logoUrl` is set, otherwise a lettermark
generated from the school's own name/initial (never "Schoolum") — so an
unbranded school still looks like itself. There's no object storage
(S3/Cloudinary) in this app, so an uploaded logo is stored as a `data:`
URL directly on `School.logoUrl` (capped at 2MB, validated to an image
MIME type in `src/lib/logo-upload.ts`) — simpler than standing up file
storage for a small crest image, and just as durable as a file on disk
would be in this single-instance deployment.

## Computer-based testing (CBT)

Online examinations — question authoring, exam scheduling, timed
student attempts, auto+manual grading, results/analytics, AI-assisted
authoring and grading, security event logging, and per-plan entitlement
limits. Built across ten focused phases in one continuous window;
documented here as one section since the design decisions interlock.
15 models and 11 enums (`prisma/schema.prisma`, appended after
`Feedback`), all designed up front in Phase 1 so later phases never
needed a schema change beyond the plan-limit columns Phase 9 added.

**Question bank.** `CBTQuestion` supports eight types
(`MULTIPLE_CHOICE`, `MULTIPLE_SELECT`, `TRUE_FALSE`, `SHORT_ANSWER`,
`FILL_IN_BLANK`, `ESSAY`, `MATCHING`, `ORDERING`). A manually authored
question is immediately `APPROVED` — teacher authorship *is* the
review; only `AI_GENERATED` questions land in `AI_PENDING_REVIEW` and
need an explicit `approveQuestion()` call before an exam can use them.
For `ORDERING`, the answer key is the option's own `order` field; for
`MATCHING`, it's each option's own `text`/`matchText` pairing — neither
type uses `isCorrect`, unlike every other option-based type. CSV import
(`src/lib/services/cbt-questions.ts`) is a deliberately scoped preview-
then-confirm flow covering only the three types a flat spreadsheet row
can express unambiguously (`MULTIPLE_CHOICE`/`MULTIPLE_SELECT`/
`TRUE_FALSE`); essay/matching/ordering need the full form.

**Exam creation.** `CBTExam` supports two question-selection modes:
`MANUAL` (a fixed, ordered list via `CBTExamQuestion`) or `BLUEPRINT`
(rules — topic/difficulty/count — that resolve to a fresh random draw
from the approved pool *at attempt-start*, via `CBTExamBlueprintRule`).
Candidates are snapshotted once, from the selected class arms' currently
ACTIVE students, into `CBTExamCandidate` rows at creation/edit time —
not a live query — the same one-time-snapshot pattern
`createAssignment` already used for `AssignmentSubmission`, so who's
sitting an exam is an explicit, auditable list that a later class-roster
change never silently alters. A published exam is locked: `updateExam`,
`archiveExam` (while LIVE) and `deleteExam` all require `DRAFT` status;
`unpublishExam` only works before `startAt` — once a student could be
mid-attempt, there's no path back to editable.

**Exam status is a lazy-reconciled cache, not a live computation.** This
app has no background job runner, so `PUBLISHED → LIVE` (at `startAt`)
and `LIVE → ENDED` (at `endAt`) are computed — and persisted — the next
time anything reads the exam (`reconcileExamStatus` in
`cbt-exams.ts`), mirroring the exact pattern `entitlements.ts` already
used for subscription status. `GRADING`/`COMPLETED` are set explicitly
by the grading pipeline, never time-driven.

**The exam timer is server-authoritative, full stop.** `CBTAttempt.deadlineAt`
is computed exactly once, at `startAttempt()`, from
`exam.durationMinutes + candidate.extraTimeMinutes` — the client never
supplies a duration, and `extraTimeMinutes` comes only from a staff-set
`CBTExamCandidate` field a student can never write to. Every
`saveAnswer`/`submitAttempt`/read re-checks the deadline server-side
(`reconcileAttemptExpiry`, the same lazy-reconciliation pattern as exam
status); the client-side countdown in `exam-attempt.tsx` is display-only
and independently re-syncs whenever the server itself reports time is
up. The student-facing question payload (`getAttemptForTaking`) is built
with an explicit Prisma `select` — never `include` — so
`isCorrect`/`acceptedAnswers`/`rubric`/a `MATCHING` option's true pairing
are structurally impossible to leak into the response, not merely
omitted after the fact; a dedicated test (`attempts.test.ts`) asserts
the exact response shape excludes them. Submission is idempotent by
construction: a conditional `UPDATE … WHERE status = 'IN_PROGRESS'`
means a double-click or a retried request after a dropped response
matches zero rows the second time and safely no-ops.

**Auto-grading covers every objective type**; `ESSAY` (and any
un-auto-gradable answer) always lands in `NEEDS_MANUAL_GRADING` — grading
is never silently skipped. `MULTIPLE_SELECT` is all-or-nothing;
`MATCHING` gives proportional credit per correctly matched pair.
Negative marking is off by default and configurable per exam
(`negativeMarkPerWrong`), and only ever deducts for an answered-and-wrong
objective question — a blank answer is never penalized. "Best attempt
counts": a `GRADED` attempt is promoted to `isOfficialResult = true`
only if it beats (or is the first for) the student's current official
attempt, and only a promotion writes to the gradebook — reusing the
existing `saveScores()` — so a lower-scoring retake never overwrites a
better one. There's deliberately no separate `CBTResult` model;
`isOfficialResult` on `CBTAttempt` *is* the result record. AI grading
suggestions (below) are advisory only: `CBTManualGrade.aiSuggestedMarks`/
`aiSuggestedFeedback` are stored alongside — never instead of — the
human's own `marksAwarded`/`feedback`.

**Practice exams retake without ever touching the gradebook.**
`CBTExam.isPractice` makes `finalizeAttemptScore` return before the
official-attempt promotion — a retake is graded (the student still sees
a score) but never becomes `isOfficialResult`, so it can never post to
`Score` or skew `getExamAnalytics`'s aggregates. That meant
`getExamResultForStudent`'s original `isOfficialResult: true` lookup
could never find *any* attempt for a practice exam — a real bug caught
only once Phase 10 actually took the seeded practice exam through the
full student flow via Playwright, not by any of the 100+ existing unit
tests, none of which had ever exercised `isPractice: true` end-to-end.
Fixed by branching that lookup (and the student portal's "View result"
link) on `exam.isPractice`: a practice exam shows the *most recent*
`GRADED` attempt instead of the one official one — the natural analogue
of "the result" when retakes are unlimited and none is more official
than any other.

**Result visibility is a three-way gate** (`CBTExam.resultVisibility`):
`IMMEDIATE` shows a student their own result the moment their own
attempt is `GRADED`, independent of anyone else; `AFTER_GRADING`
withholds it from *everyone* until the whole exam's grading is done
(`isExamFullyGraded`) — so an early finisher can never see, or leak, the
answer key while classmates are still sitting the exam; `MANUAL_RELEASE`
withholds it until a teacher explicitly sets `resultsReleasedAt`.
`showCorrectAnswers`/`showExplanations`/`showRanking` are independent
per-exam opt-ins layered on top of whichever gate applies.

**AI functionality** (`src/lib/services/cbt-ai.ts`) reuses the Phase 5
`AiProvider` registry directly — one-shot `provider.generate()` calls,
not the multi-turn `AiConversation` machinery — and, like the assistant,
never fakes a response: `isCbtAiConfigured()` gates every entry point
with an honest "isn't configured" message when no `OPENAI_API_KEY`/
`ANTHROPIC_API_KEY` is set. Four features: **question generation**
(always `AI_PENDING_REVIEW`/`AI_GENERATED`, the same never-auto-approved
rule as manual authoring's opposite — AI output is never usable until a
human explicitly approves each one); **exam insights** for teachers,
fed only aggregate `ExamAnalytics` — no student name or ID ever reaches
the model; **revision plans** for students, built only from that
student's own already-visible result, with ephemeral practice questions
shown once and never written into `CBTQuestion` (they're a private study
aid, not future exam content, so they don't need the review step real
generated questions do); and **grading suggestions**, advisory-only per
the `CBTManualGrade` note above.

**Security logging is observational, never punitive.** `CBTSecurityEvent`
records what happened during an attempt — tab switches, window blur,
fullscreen exits, copy/paste/right-click attempts, connection loss — for
a staff member with `cbt.view_results` to review at
`/dashboard/cbt/exams/[id]/security`; nothing here auto-flags, scores,
or blocks a student on its own. Client-side detectors
(`exam-attempt.tsx`) are throttled per event type so a burst (rapid
alt-tabbing) doesn't spam a write per occurrence. `requireFullscreen` is
enforced with a real gate — the exam UI doesn't render until the student
clicks into fullscreen, since browsers refuse `requestFullscreen()`
without a user gesture — but exiting mid-exam only logs and re-shows the
gate; the timer keeps running regardless, a nudge rather than a
technical lock. Exam extensions (`grantExamExtension`) let a
`cbt.start` holder set a candidate's total accommodation and, if an
attempt is already in progress, shift its `deadlineAt` by the delta so
the extension takes effect mid-sitting, not just on a future attempt.

**Subscription entitlements** wire the four CBT feature flags — defined
in `src/lib/billing/features.ts` since Phase 1 but, like every other
feature flag in the app, never actually enforced anywhere until CBT
Phase 9 — into real `requireFeature()`/`hasFeature()` gates for the
first time in this codebase. `cbt` gates the whole module; `cbt_question_bank`
gates CSV import specifically (manual single-question authoring is base
`cbt`); `cbt_ai_generation` gates all four AI features; `cbt_advanced_analytics`
gates the per-question facility/analysis breakdown on the results page.
Four numeric plan limits (`SubscriptionPlan.cbtActiveExamLimit`/
`cbtQuestionBankLimit`/`cbtAiQuestionsPerMonthLimit`/`cbtCandidateLimit`,
`null` = unlimited, editable from `/platform/plans` the same way
`studentLimit` already was) are enforced at the real choke points: a
`DRAFT` exam never counts against the active-exam ceiling, only
*publishing* does; a question-bank batch (CSV import, an AI generation
request) is checked up front so it fails atomically rather than partway
through; the candidate ceiling counts *distinct* students across all of
a school's exams in the same term, not a row per exam, so one student
sitting five exams occupies one seat. Because the `SubscriptionPlan`
rows already provisioned in this environment predated these four feature
keys entirely — `createPlan`/`ensureDefaultPlans`/the seed script only
ever set `features` on a plan's first `INSERT`, by design, so a Super
Admin's live edits in `/platform/plans` survive a redeploy — every real
seeded school would have read as lacking `cbt` outright the moment these
gates landed. Fixed with a one-time `jsonb`-merge backfill in Phase 9's
own migration, guarded by `NOT (features ? 'key')` so it only ever adds
a key that's actually missing.

**Testing.** 124 tests across 12 files in `tests/cbt/` — every service
function's tenant isolation, every grading rule per question type, the
full result-visibility matrix, the AI provider's fake-and-verify pattern
(`vi.mock` on the registry, since no real API key exists in a sandbox),
every plan-limit boundary, and the practice-exam regression above.

Full phase order: 1 database foundation → 2 question bank → 3 exam
creation → 4 student examination interface → 5 submission and grading →
6 results and analytics → 7 AI functionality → 8 security and audit →
9 subscription integration → 10 testing and polish (a seeded "Numeracy
Practice Test" — 20 auto-generated questions, 30 minutes, `isPractice`,
retakeable — so `student@horizon.demo` can experience the whole flow
without touching their real assessment record).

## Online Learning: self-paced lectures & native live virtual classroom

A full LMS layer — self-paced lectures with resources and progress
tracking, plus a real-time video classroom taught entirely inside
Schoolum — appended to `prisma/schema.prisma` after the CBT section.
Eight new models (`Lecture`, `LectureResource`, `StudentLectureProgress`,
`LiveClass`, `LiveClassAttendance`, `LiveClassAttendanceSegment`,
`ClassroomMessage`, `LiveClassRecording`), reusing `Notification`/
`AuditLog` for alerts and audit trail the same way CBT does, rather than
duplicating either.

**Real-time video architecture.** This app's hosting (Vercel serverless
functions) cannot itself run a persistent media or signaling server, and
a browser-to-browser mesh (every participant sending video directly to
every other participant) doesn't scale past a handful of people. The
classroom is built on **LiveKit**, an open-source SFU (Selective
Forwarding Unit) — every participant sends one stream to the LiveKit
server, which forwards it to everyone else. `LIVEKIT_URL`/
`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (`.env.example`) point at either
LiveKit Cloud or a self-hosted LiveKit instance interchangeably; either
way, the student/teacher experience is 100% inside Schoolum's own UI at
`/classroom/[liveClassId]` (`src/components/classroom/virtual-classroom.tsx`)
— nobody creates a LiveKit account, sees LiveKit's own interface, or is
redirected off Schoolum. `src/lib/live-classroom/livekit.ts` mints a
short-lived (4h), room-and-user-scoped JWT server-side, the *only* way a
browser ever gets into a room, and degrades to an honest "not configured"
message when the env vars are unset — the same pattern every other
external integration in this app follows (payment gateways, the AI
assistant). Chat and raise-hand signals ride LiveKit's own data channel
for instant delivery to everyone already connected, backed by a DB row
(`ClassroomMessage`, `LiveClassAttendance.handRaised`) for persistence,
history and moderation. Screen share, mute/unmute, camera on/off, active-
speaker detection and automatic reconnection on a dropped connection are
all handled by the LiveKit SDK (`@livekit/components-react`) rather than
built from scratch. Recording (optional; needs a LiveKit Egress-writable
S3 bucket, `RECORDING_S3_*`) is scaffolded on `LiveClassRecording` but,
per the "no secret recording" requirement, only ever starts on an
explicit teacher action.

**File storage.** Lecture videos/documents and recordings go to Vercel
Blob (`src/lib/storage/blob.ts`, private access) rather than the `data:`
URL pattern logos/photos use elsewhere — those fit in a database column;
a lecture video does not. Every stored file is served back only through
this app's own authenticated route
(`src/app/api/online-learning/lecture-resources/[resourceId]/route.ts`),
which re-runs the lecture's own visibility check before streaming bytes
— the underlying Blob URL is never sent to a browser directly.

**Authorization.** `assertTeacherAssignment` (`src/lib/services/lectures.ts`)
is the one gate every lecture/live-class create or edit passes through: a
teacher may only act on a subject+classArm pair they hold a real
`TeacherAssignment` row for, re-checked server-side on every write, never
inferred from `lectures.manage` alone. Student-facing reads
(`listLecturesForStudent`, `getStudentLiveClassAccess`) always re-derive
the calling student's own `classArmId` from their `Student` row — never
trust a classArmId or liveClassId a client supplies — so a lecture or
live class is reachable only by students actually enrolled in its target
class, in its own school; a cross-school or cross-class id is
structurally a 404, not a 403 (never reveals that the row exists
elsewhere). `getStudentLiveClassAccess` is the single source of truth for
join eligibility, called identically by the page that shows the "Join"
button and the route that mints a room token — there is no second path
into a room.

**Lecture progress.** A `StudentLectureProgress` row is created lazily on
first open (`markLectureOpened`), never implying completion just because
a student opened the page. A video/audio resource crossing an 80% watch
threshold (`updateVideoProgress`) auto-completes the lecture; a written/
document lecture needs an explicit "Mark as complete"
(`markLectureCompleteManually`). Both are one-way — reopening a completed
lecture updates the resume position but never un-completes it.

**Live class attendance.** `LiveClassAttendance` rows are created for
every ACTIVE student the moment a class is scheduled (default `ABSENT`),
mirroring `AssignmentSubmission`'s "create the whole roster up front"
pattern — a no-show is visible on the report, not silently missing.
Each connect/disconnect is its own `LiveClassAttendanceSegment`; a
student who drops and reconnects keeps their earlier segment's time
rather than losing it, and `endLiveClass` sums every segment to decide
`ATTENDED` (≥70% of class duration present) vs. `LEFT_EARLY` vs. `ABSENT`
— never "present" merely because they clicked Join once.

**Testing.** `tests/online-learning/security.test.ts` covers the brief's
own worked scenario directly: two schools each with their own "JSS 2A"
class, a lecture/live-class published in School A invisible to School B's
students even though the class *name* collides, a same-school student in
a different class rejected, a cross-school student's live-class access
attempt rejected as `not_found`, the not-started/in-progress/completed
progress matrix, and attendance math across a join/disconnect/reconnect.

## Phased roadmap

Matches the brief exactly: Phase 1 Foundation → Phase 2 Academics → Phase 3
Finance → Phase 4 Communication/parent & student portals → Phase 5 AI →
Phase 6 Advanced ERP (payroll/library/transport/hostel) → Phase 7 SaaS
billing & platform admin → Administration (nested nav, admission, calendar,
feedback) → multi-provider payments & portal branding → Subscription &
billing system (four real-priced tiers, centralized entitlements,
self-serve upgrade/downgrade, platform-billing Paystack + webhook, billing
dashboard, Enterprise inquiries) → Computer-based testing (ten phases,
detailed above) → Online Learning (self-paced lectures + native LiveKit
virtual classroom, detailed above), each landing as the brief's own
priorities evolved.
