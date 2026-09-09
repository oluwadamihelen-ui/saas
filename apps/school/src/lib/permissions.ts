// Canonical module.action permission catalog (brief section 3). Only
// permissions for modules that actually exist in this phase are listed —
// finance/results/attendance permissions get added when those modules do,
// not seeded ahead of time as inert placeholders.
//
// The catalog is fixed in code; which roles have which permission is the
// tenant-editable part, stored in RolePermission and seeded per school from
// ROLE_DEFAULT_PERMISSIONS below so a school can later customize its own
// matrix without affecting any other school.

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  STUDENTS_VIEW: "students.view",
  STUDENTS_CREATE: "students.create",
  STUDENTS_EDIT: "students.edit",
  STUDENTS_DELETE: "students.delete",
  GUARDIANS_MANAGE: "guardians.manage",
  STAFF_VIEW: "staff.view",
  STAFF_INVITE: "staff.invite",
  STAFF_MANAGE: "staff.manage",
  ROLES_MANAGE: "roles.manage",
  ACADEMICS_MANAGE: "academics.manage",
  SCHOOL_SETTINGS_MANAGE: "school_settings.manage",
  AUDIT_VIEW: "audit.view",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MARK: "attendance.mark",
  TIMETABLE_VIEW: "timetable.view",
  TIMETABLE_MANAGE: "timetable.manage",
  ASSIGNMENTS_VIEW: "assignments.view",
  ASSIGNMENTS_MANAGE: "assignments.manage",
  RESULTS_VIEW: "results.view",
  RESULTS_ENTER: "results.enter",
  RESULTS_APPROVE: "results.approve",
  RESULTS_PUBLISH: "results.publish",
  GRADING_MANAGE: "grading.manage",
  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_RECORD: "payments.record",
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_APPROVE: "expenses.approve",
  ANNOUNCEMENTS_VIEW: "announcements.view",
  ANNOUNCEMENTS_MANAGE: "announcements.manage",
  MESSAGES_VIEW: "messages.view",
  MESSAGES_MANAGE: "messages.manage",
  ASSISTANT_USE: "assistant.use",
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_MANAGE: "payroll.manage",
  PAYROLL_APPROVE: "payroll.approve",
  LIBRARY_VIEW: "library.view",
  LIBRARY_MANAGE: "library.manage",
  TRANSPORT_VIEW: "transport.view",
  TRANSPORT_MANAGE: "transport.manage",
  HOSTEL_VIEW: "hostel.view",
  HOSTEL_MANAGE: "hostel.manage",
  BILLING_VIEW: "billing.view",
  USERS_MANAGE: "users.manage",
  ADMISSION_VIEW: "admission.view",
  ADMISSION_MANAGE: "admission.manage",
  CALENDAR_VIEW: "calendar.view",
  CALENDAR_MANAGE: "calendar.manage",
  FEEDBACK_VIEW: "feedback.view",
  FEEDBACK_MANAGE: "feedback.manage",
  PAYMENT_GATEWAYS_MANAGE: "payment_gateways.manage",
  BILLING_MANAGE: "billing.manage",
  CBT_VIEW: "cbt.view",
  CBT_CREATE: "cbt.create",
  CBT_EDIT: "cbt.edit",
  CBT_PUBLISH: "cbt.publish",
  CBT_START: "cbt.start",
  CBT_GRADE: "cbt.grade",
  CBT_VIEW_RESULTS: "cbt.view_results",
  CBT_EXPORT: "cbt.export",
  CBT_MANAGE_QUESTION_BANK: "cbt.manage_question_bank",
  CBT_GENERATE_AI_QUESTIONS: "cbt.generate_ai_questions",
  TRANSCRIPTS_VIEW: "transcripts.view",
  TRANSCRIPTS_MANAGE: "transcripts.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: { key: PermissionKey; module: string; description: string }[] = [
  { key: PERMISSIONS.DASHBOARD_VIEW, module: "dashboard", description: "View the school dashboard" },
  { key: PERMISSIONS.STUDENTS_VIEW, module: "students", description: "View student records" },
  { key: PERMISSIONS.STUDENTS_CREATE, module: "students", description: "Enroll new students" },
  { key: PERMISSIONS.STUDENTS_EDIT, module: "students", description: "Edit student records" },
  { key: PERMISSIONS.STUDENTS_DELETE, module: "students", description: "Withdraw/delete student records" },
  { key: PERMISSIONS.GUARDIANS_MANAGE, module: "students", description: "Manage parent/guardian records" },
  { key: PERMISSIONS.STAFF_VIEW, module: "staff", description: "View staff accounts" },
  { key: PERMISSIONS.STAFF_INVITE, module: "staff", description: "Invite new staff members" },
  { key: PERMISSIONS.STAFF_MANAGE, module: "staff", description: "Edit or deactivate staff accounts" },
  { key: PERMISSIONS.ROLES_MANAGE, module: "staff", description: "Change role permission assignments" },
  { key: PERMISSIONS.ACADEMICS_MANAGE, module: "academics", description: "Manage sessions, terms, classes, subjects and teacher assignments" },
  { key: PERMISSIONS.SCHOOL_SETTINGS_MANAGE, module: "school", description: "Edit school profile and branding" },
  { key: PERMISSIONS.AUDIT_VIEW, module: "administration", description: "View the audit log" },
  { key: PERMISSIONS.ATTENDANCE_VIEW, module: "attendance", description: "View attendance records" },
  { key: PERMISSIONS.ATTENDANCE_MARK, module: "attendance", description: "Mark attendance for a class" },
  { key: PERMISSIONS.TIMETABLE_VIEW, module: "timetable", description: "View timetables" },
  { key: PERMISSIONS.TIMETABLE_MANAGE, module: "timetable", description: "Create and edit timetable slots" },
  { key: PERMISSIONS.ASSIGNMENTS_VIEW, module: "assignments", description: "View assignments" },
  { key: PERMISSIONS.ASSIGNMENTS_MANAGE, module: "assignments", description: "Create assignments and grade submissions" },
  { key: PERMISSIONS.RESULTS_VIEW, module: "results", description: "View scores and report cards" },
  { key: PERMISSIONS.RESULTS_ENTER, module: "results", description: "Enter subject scores" },
  { key: PERMISSIONS.RESULTS_APPROVE, module: "results", description: "Approve report cards" },
  { key: PERMISSIONS.RESULTS_PUBLISH, module: "results", description: "Publish report cards" },
  { key: PERMISSIONS.GRADING_MANAGE, module: "results", description: "Configure grading scale and assessment components" },
  { key: PERMISSIONS.FINANCE_VIEW, module: "finance", description: "View fee structures and invoices" },
  { key: PERMISSIONS.FINANCE_MANAGE, module: "finance", description: "Configure fee structures and generate invoices" },
  { key: PERMISSIONS.PAYMENTS_VIEW, module: "finance", description: "View payments received" },
  { key: PERMISSIONS.PAYMENTS_RECORD, module: "finance", description: "Record manual payments against an invoice" },
  { key: PERMISSIONS.EXPENSES_VIEW, module: "finance", description: "View expense records" },
  { key: PERMISSIONS.EXPENSES_CREATE, module: "finance", description: "Record a new expense" },
  { key: PERMISSIONS.EXPENSES_APPROVE, module: "finance", description: "Approve or reject expenses above the approval threshold" },
  { key: PERMISSIONS.ANNOUNCEMENTS_VIEW, module: "communication", description: "View announcements addressed to staff" },
  { key: PERMISSIONS.ANNOUNCEMENTS_MANAGE, module: "communication", description: "Create and publish announcements" },
  { key: PERMISSIONS.MESSAGES_VIEW, module: "communication", description: "View parent/guardian messages" },
  { key: PERMISSIONS.MESSAGES_MANAGE, module: "communication", description: "Reply to and close parent/guardian conversations" },
  { key: PERMISSIONS.ASSISTANT_USE, module: "assistant", description: "Use the AI assistant" },
  { key: PERMISSIONS.PAYROLL_VIEW, module: "payroll", description: "View salary structures, payroll runs and payslips" },
  { key: PERMISSIONS.PAYROLL_MANAGE, module: "payroll", description: "Configure salary structures and generate payroll runs" },
  { key: PERMISSIONS.PAYROLL_APPROVE, module: "payroll", description: "Approve payroll runs and mark them paid" },
  { key: PERMISSIONS.LIBRARY_VIEW, module: "library", description: "View the book catalog and loan records" },
  { key: PERMISSIONS.LIBRARY_MANAGE, module: "library", description: "Manage the book catalog and issue/return loans" },
  { key: PERMISSIONS.TRANSPORT_VIEW, module: "transport", description: "View vehicles, routes and student transport assignments" },
  { key: PERMISSIONS.TRANSPORT_MANAGE, module: "transport", description: "Manage vehicles, routes and student transport assignments" },
  { key: PERMISSIONS.HOSTEL_VIEW, module: "hostel", description: "View hostels, rooms and student room assignments" },
  { key: PERMISSIONS.HOSTEL_MANAGE, module: "hostel", description: "Manage hostels, rooms and student room assignments" },
  { key: PERMISSIONS.BILLING_VIEW, module: "billing", description: "View the school's own platform subscription and billing history" },
  { key: PERMISSIONS.USERS_MANAGE, module: "administration", description: "View every account on the school (staff and portal) and reset a user's password" },
  { key: PERMISSIONS.ADMISSION_VIEW, module: "administration", description: "View admission applicants" },
  { key: PERMISSIONS.ADMISSION_MANAGE, module: "administration", description: "Set the admission fee, process applicants and admit them as students" },
  { key: PERMISSIONS.CALENDAR_VIEW, module: "administration", description: "View the school calendar" },
  { key: PERMISSIONS.CALENDAR_MANAGE, module: "administration", description: "Create, edit and remove calendar events" },
  { key: PERMISSIONS.FEEDBACK_VIEW, module: "administration", description: "View feedback submitted by staff and parents" },
  { key: PERMISSIONS.FEEDBACK_MANAGE, module: "administration", description: "Mark submitted feedback as reviewed" },
  { key: PERMISSIONS.PAYMENT_GATEWAYS_MANAGE, module: "finance", description: "Connect and manage the school's own online payment gateway credentials" },
  { key: PERMISSIONS.BILLING_MANAGE, module: "billing", description: "Upgrade, downgrade, cancel or renew the school's own Winfield subscription" },
  { key: PERMISSIONS.CBT_VIEW, module: "cbt", description: "View CBT examinations and their configuration" },
  { key: PERMISSIONS.CBT_CREATE, module: "cbt", description: "Create new CBT examinations" },
  { key: PERMISSIONS.CBT_EDIT, module: "cbt", description: "Edit an examination's questions, configuration or schedule" },
  { key: PERMISSIONS.CBT_PUBLISH, module: "cbt", description: "Publish a CBT examination, making it visible to its candidates" },
  { key: PERMISSIONS.CBT_START, module: "cbt", description: "Control a live examination (extend, pause candidates, reset an attempt)" },
  { key: PERMISSIONS.CBT_GRADE, module: "cbt", description: "Manually grade essay/short-answer CBT questions" },
  { key: PERMISSIONS.CBT_VIEW_RESULTS, module: "cbt", description: "View CBT results, analytics and the security event log" },
  { key: PERMISSIONS.CBT_EXPORT, module: "cbt", description: "Export CBT results and analytics as PDF/CSV/Excel" },
  { key: PERMISSIONS.CBT_MANAGE_QUESTION_BANK, module: "cbt", description: "Create, edit, tag and archive question bank entries" },
  { key: PERMISSIONS.CBT_GENERATE_AI_QUESTIONS, module: "cbt", description: "Generate draft CBT questions with the AI assistant" },
  { key: PERMISSIONS.TRANSCRIPTS_VIEW, module: "transcripts", description: "View, generate, download and print student academic transcripts" },
  { key: PERMISSIONS.TRANSCRIPTS_MANAGE, module: "transcripts", description: "Revoke an issued transcript" },
];

/// System roles seeded into every new school (brief section 3's role list).
/// PARENT and STUDENT are seeded so the schema/role model doesn't need to
/// change when the parent/student portals land in Phase 4 — they carry no
/// dashboard permissions yet because there is no portal UI for them.
export const SYSTEM_ROLE_KEYS = [
  "SCHOOL_OWNER",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "ACCOUNTANT",
  "HR_STAFF",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "PARENT",
  "STUDENT",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const SYSTEM_ROLE_LABELS: Record<SystemRoleKey, string> = {
  SCHOOL_OWNER: "School Owner",
  SCHOOL_ADMIN: "School Administrator",
  PRINCIPAL: "Head of School",
  TEACHER: "Teacher",
  ACCOUNTANT: "Accountant / Bursar",
  HR_STAFF: "HR / Admin Staff",
  LIBRARIAN: "Librarian",
  TRANSPORT_MANAGER: "Transport Manager",
  PARENT: "Parent",
  STUDENT: "Student",
};

const ALL_PERMISSIONS = PERMISSION_CATALOG.map((p) => p.key);

/// Enrolling a student (students.create) is deliberately restricted to
/// SCHOOL_OWNER and PRINCIPAL ("Head of School") only — not even
/// SCHOOL_ADMIN gets it by default, so the ALL_PERMISSIONS shortcut below
/// explicitly carves it out alongside ROLES_MANAGE. billing.view is
/// carved out the same way — the school's relationship with the platform
/// (plan, invoices) is owner-only, not even school-admin-visible by
/// default. payment_gateways.manage gets the same owner-only treatment:
/// these are live secret API keys that can redirect where the school's
/// money goes, at least as sensitive as the billing relationship.
export const ROLE_DEFAULT_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  SCHOOL_OWNER: ALL_PERMISSIONS,
  SCHOOL_ADMIN: ALL_PERMISSIONS.filter(
    (p) =>
      p !== PERMISSIONS.ROLES_MANAGE &&
      p !== PERMISSIONS.STUDENTS_CREATE &&
      p !== PERMISSIONS.BILLING_VIEW &&
      p !== PERMISSIONS.PAYMENT_GATEWAYS_MANAGE &&
      p !== PERMISSIONS.BILLING_MANAGE
  ),
  PRINCIPAL: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_EDIT,
    PERMISSIONS.GUARDIANS_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.ACADEMICS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.TIMETABLE_VIEW,
    PERMISSIONS.TIMETABLE_MANAGE,
    PERMISSIONS.ASSIGNMENTS_VIEW,
    PERMISSIONS.RESULTS_VIEW,
    PERMISSIONS.RESULTS_APPROVE,
    PERMISSIONS.RESULTS_PUBLISH,
    PERMISSIONS.GRADING_MANAGE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.ANNOUNCEMENTS_VIEW,
    PERMISSIONS.ANNOUNCEMENTS_MANAGE,
    PERMISSIONS.MESSAGES_VIEW,
    PERMISSIONS.MESSAGES_MANAGE,
    PERMISSIONS.ASSISTANT_USE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.LIBRARY_VIEW,
    PERMISSIONS.TRANSPORT_VIEW,
    PERMISSIONS.HOSTEL_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.ADMISSION_VIEW,
    PERMISSIONS.CBT_VIEW,
    PERMISSIONS.CBT_PUBLISH,
    PERMISSIONS.CBT_START,
    PERMISSIONS.CBT_VIEW_RESULTS,
    PERMISSIONS.CBT_EXPORT,
    PERMISSIONS.TRANSCRIPTS_VIEW,
    PERMISSIONS.TRANSCRIPTS_MANAGE,
  ],
  TEACHER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.TIMETABLE_VIEW,
    PERMISSIONS.ASSIGNMENTS_VIEW,
    PERMISSIONS.ASSIGNMENTS_MANAGE,
    PERMISSIONS.RESULTS_VIEW,
    PERMISSIONS.RESULTS_ENTER,
    PERMISSIONS.ANNOUNCEMENTS_VIEW,
    PERMISSIONS.ASSISTANT_USE,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.CBT_VIEW,
    PERMISSIONS.CBT_CREATE,
    PERMISSIONS.CBT_EDIT,
    PERMISSIONS.CBT_START,
    PERMISSIONS.CBT_GRADE,
    PERMISSIONS.CBT_VIEW_RESULTS,
    PERMISSIONS.CBT_MANAGE_QUESTION_BANK,
    PERMISSIONS.CBT_GENERATE_AI_QUESTIONS,
  ],
  ACCOUNTANT: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_VIEW,
    PERMISSIONS.ASSISTANT_USE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.CALENDAR_VIEW,
  ],
  HR_STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_INVITE,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.ANNOUNCEMENTS_VIEW,
    PERMISSIONS.ASSISTANT_USE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.HOSTEL_VIEW,
    PERMISSIONS.HOSTEL_MANAGE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ADMISSION_VIEW,
    PERMISSIONS.ADMISSION_MANAGE,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.FEEDBACK_VIEW,
    PERMISSIONS.FEEDBACK_MANAGE,
  ],
  LIBRARIAN: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANNOUNCEMENTS_VIEW,
    PERMISSIONS.ASSISTANT_USE,
    PERMISSIONS.LIBRARY_VIEW,
    PERMISSIONS.LIBRARY_MANAGE,
    PERMISSIONS.CALENDAR_VIEW,
  ],
  TRANSPORT_MANAGER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANNOUNCEMENTS_VIEW,
    PERMISSIONS.ASSISTANT_USE,
    PERMISSIONS.TRANSPORT_VIEW,
    PERMISSIONS.TRANSPORT_MANAGE,
    PERMISSIONS.CALENDAR_VIEW,
  ],
  PARENT: [],
  STUDENT: [],
};

/// The single platform-level role (School = null). Not part of
/// SYSTEM_ROLE_KEYS/ROLE_DEFAULT_PERMISSIONS above — those are tenant
/// roles seeded fresh per school. This one is seeded exactly once, globally
/// (see ensureSuperAdminRole in src/lib/school-provisioning.ts), and access
/// is checked directly against the session's role key (requireSuperAdmin in
/// src/lib/auth/require.ts) rather than through the per-school
/// RolePermission system every tenant role uses — a Super Admin isn't
/// scoped to a school's data at all, so "does this role have
/// students.view" is a meaningless question for it.
export const SUPER_ADMIN_ROLE_KEY = "SUPER_ADMIN";
