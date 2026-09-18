import type { SystemRoleKey } from "@/lib/permissions";

/// Everything the public "view a Schoolum demo" experience needs, in one
/// place — imported both by the app (src/app/demo) and by
/// prisma/seed/index.ts, so the seeded "Horizon Academy" accounts and the
/// one-click login buttons can never drift apart. Not a secret: this is a
/// deliberately public sandbox school with fake data, seeded fresh by
/// `npm run db:seed` (which deletes and recreates it every run).
export const DEMO_PASSWORD = "Passw0rd!23";

export const DEMO_ROLE_EMAILS: Record<SystemRoleKey, string> = {
  SCHOOL_OWNER: "owner@horizon.demo",
  SCHOOL_ADMIN: "admin@horizon.demo",
  PRINCIPAL: "principal@horizon.demo",
  TEACHER: "teacher1@horizon.demo",
  ACCOUNTANT: "accountant@horizon.demo",
  HR_STAFF: "hr@horizon.demo",
  LIBRARIAN: "librarian@horizon.demo",
  TRANSPORT_MANAGER: "transport@horizon.demo",
  PARENT: "parent@horizon.demo",
  STUDENT: "student@horizon.demo",
};

export const DEMO_ROLE_DESCRIPTIONS: Record<SystemRoleKey, string> = {
  SCHOOL_OWNER: "Full access — billing, settings, and every module.",
  SCHOOL_ADMIN: "Day-to-day school administration.",
  PRINCIPAL: "Academic oversight and approvals.",
  TEACHER: "Classes, results, assignments, and attendance.",
  ACCOUNTANT: "Fees, invoices, payroll, and expenses.",
  HR_STAFF: "Staff records and payroll.",
  LIBRARIAN: "Book catalogue and loans.",
  TRANSPORT_MANAGER: "Routes, vehicles, and stop assignments.",
  PARENT: "The parent portal — a child's fees, results, and attendance.",
  STUDENT: "The student portal — assignments, results, and timetable.",
};

/// Order the role cards appear in on the demo landing page — leadership
/// first, then day-to-day staff, then the two portal accounts last.
export const DEMO_ROLE_ORDER: SystemRoleKey[] = [
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
];
