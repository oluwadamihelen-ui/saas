# Winfield — Architecture

Winfield is a multi-tenant AI-native school management platform. This document
describes the system as implemented through **Phase 1 (Foundation)** and
**Phase 2 (Academics)** — see the [root README](../../README.md#school-platform--architecture-assessment-phase-1-kickoff)
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
  `attendance.mark`, `results.approve`. The catalog only lists permissions
  for modules that actually exist — finance permissions, for instance,
  aren't seeded ahead of time as inert placeholders.
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
- **Enforcement is server-side only.** `requirePermission(key)` re-checks the
  database on every call (no caching across requests) so a permission change
  takes effect immediately rather than waiting out a session's JWT lifetime.
  Nothing in the UI hides an action as its only form of access control.

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

## AI architecture (not yet built)

Phase 1 has no AI code — no chatbot, no scripted "AI insight" text. Building
the intent → permission-check → tool-call → audit pipeline described in the
brief now, before there's real attendance/results/finance data for it to
reason over, would mean either faking its output (explicitly disallowed) or
building against a data shape that's likely to change once Phase 2/3 land.
The permission-string system above exists specifically so Phase 5's AI tools
can reuse the exact same `requirePermission()` checks the UI uses, rather
than inventing a parallel authorization path.

## Testing tenant isolation

Still not automated (no test suite exists for this app yet — `vitest` is
wired up in `package.json` but empty; Phase 1 and Phase 2 were both verified
manually end-to-end against a real database instead). The service-layer
pattern above (`schoolId` as a mandatory first argument everywhere) is the
structural mitigation in place; a "School A cannot read School B's students"
integration test, per the brief's testing requirements, is overdue and
should be the first thing added in Phase 3 rather than deferred again.

## Phased roadmap

Matches the brief exactly: Phase 1 Foundation → Phase 2 Academics (this) →
Phase 3 Finance → Phase 4 Communication/parent & student portals → Phase 5
AI → Phase 6 Advanced ERP (payroll/library/transport/hostel) → Phase 7 SaaS
billing & platform admin.
