# Winfield — Architecture

Winfield is a multi-tenant AI-native school management platform. This document
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

## Phased roadmap

Matches the brief exactly: Phase 1 Foundation → Phase 2 Academics → Phase 3
Finance → Phase 4 Communication/parent & student portals → Phase 5 AI →
Phase 6 Advanced ERP (payroll/library/transport/hostel, this) → Phase 7 SaaS
billing & platform admin.
