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
  PRINCIPAL: "Principal / Head Teacher",
  TEACHER: "Teacher",
  ACCOUNTANT: "Accountant / Bursar",
  HR_STAFF: "HR / Admin Staff",
  LIBRARIAN: "Librarian",
  TRANSPORT_MANAGER: "Transport Manager",
  PARENT: "Parent",
  STUDENT: "Student",
};

const ALL_PERMISSIONS = PERMISSION_CATALOG.map((p) => p.key);

export const ROLE_DEFAULT_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  SCHOOL_OWNER: ALL_PERMISSIONS,
  SCHOOL_ADMIN: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.ROLES_MANAGE),
  PRINCIPAL: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
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
  ],
  HR_STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_INVITE,
    PERMISSIONS.STAFF_MANAGE,
  ],
  LIBRARIAN: [PERMISSIONS.DASHBOARD_VIEW],
  TRANSPORT_MANAGER: [PERMISSIONS.DASHBOARD_VIEW],
  PARENT: [],
  STUDENT: [],
};

/// The single platform-level role (School = null). Its permission set is
/// intentionally empty in Phase 1 — the platform admin app (brief section
/// 35) is Phase 7 scope; this role exists so `User.schoolId` nullable +
/// `Role.schoolId` nullable never needs a schema change to support it.
export const SUPER_ADMIN_ROLE_KEY = "SUPER_ADMIN";
