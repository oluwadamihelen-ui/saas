// Canonical feature-entitlement catalog (spec section 9). Mirrors the
// PERMISSIONS/PERMISSION_CATALOG pattern in src/lib/permissions.ts exactly:
// a fixed catalog in code, a per-plan default matrix also in code, and the
// tenant(plan)-editable actual state stored in the database
// (SubscriptionPlan.features) — a Super Admin can flip one without a
// deploy, the seed/upsert below just establishes sane defaults.
//
// `implemented` is not sent to the client and gates nothing by itself — it
// only documents, per spec section 36, which of these actually have real
// application functionality behind them today vs. which exist purely so
// the pricing page can show the full roadmap. Only entitlements.ts's
// requireFeature() call sites (wired onto real pages/services) actually
// enforce anything; an unimplemented feature can be "true" on a plan
// without unlocking a feature that doesn't exist yet.

export const FEATURE_CATALOG = [
  // --- School Management ---
  { key: "student_management", category: "School Management", label: "Student management", implemented: true },
  { key: "parent_management", category: "School Management", label: "Parent management", implemented: true },
  { key: "staff_management", category: "School Management", label: "Teacher/staff management", implemented: true },
  { key: "classes_subjects", category: "School Management", label: "Classes & subjects", implemented: true },
  { key: "parent_portal", category: "School Management", label: "Parent portal", implemented: true },
  { key: "basic_dashboard", category: "School Management", label: "Basic school dashboard", implemented: true },
  { key: "multiple_campuses", category: "School Management", label: "Multiple campuses", implemented: false },
  { key: "custom_branding", category: "School Management", label: "Custom school branding", implemented: true },

  // --- Academics ---
  { key: "timetable", category: "Academics", label: "Timetable", implemented: true },
  { key: "assignments", category: "Academics", label: "Assignments", implemented: true },
  { key: "exams_results", category: "Academics", label: "Exams & results", implemented: true },
  { key: "report_cards", category: "Academics", label: "Report cards", implemented: true },
  { key: "custom_grading", category: "Academics", label: "Custom grading systems", implemented: false },

  // --- Attendance ---
  { key: "attendance", category: "Attendance", label: "Attendance", implemented: true },
  { key: "advanced_attendance_analytics", category: "Attendance", label: "Advanced attendance analytics", implemented: false },

  // --- Finance ---
  { key: "finance", category: "Finance", label: "Online fee management", implemented: true },
  { key: "invoices", category: "Finance", label: "Invoices", implemented: true },
  { key: "receipts", category: "Finance", label: "Receipts", implemented: true },
  { key: "payment_tracking", category: "Finance", label: "Payment tracking", implemented: true },
  { key: "expenses", category: "Finance", label: "Expenses", implemented: true },
  { key: "advanced_finance", category: "Finance", label: "Advanced finance", implemented: false },

  // --- Admissions ---
  { key: "admissions", category: "Admissions", label: "Admissions", implemented: true },
  { key: "document_management", category: "Admissions", label: "Document management", implemented: false },

  // --- Communication ---
  { key: "announcements", category: "Communication", label: "Announcements", implemented: true },
  { key: "email_notifications", category: "Communication", label: "Email notifications", implemented: false },
  { key: "sms", category: "Communication", label: "SMS integration", implemented: false },
  { key: "whatsapp", category: "Communication", label: "WhatsApp integration", implemented: false },
  { key: "advanced_parent_communication", category: "Communication", label: "Advanced parent communication", implemented: false },

  // --- Analytics ---
  { key: "advanced_academic_analytics", category: "Analytics", label: "Advanced academic analytics", implemented: false },
  { key: "advanced_analytics", category: "Analytics", label: "Advanced analytics", implemented: false },

  // --- AI ---
  { key: "basic_ai", category: "AI", label: "Basic AI assistant", implemented: true },
  { key: "ai_report_comments", category: "AI", label: "AI report-card comments", implemented: false },
  { key: "ai_question_generation", category: "AI", label: "AI question generation", implemented: false },
  { key: "ai_assignment_generation", category: "AI", label: "AI assignment generation", implemented: false },
  { key: "ai_performance_analysis", category: "AI", label: "AI performance analysis", implemented: true },
  { key: "ai_school_insights", category: "AI", label: "AI school insights", implemented: false },
  { key: "ai_timetable_assistant", category: "AI", label: "AI timetable assistant", implemented: false },
  { key: "advanced_ai", category: "AI", label: "Advanced AI assistant", implemented: false },
  { key: "ai_admin_automation", category: "AI", label: "AI-powered administrative automation", implemented: false },
  { key: "ai_document_processing", category: "AI", label: "AI document processing", implemented: false },

  // --- CBT (Computer-Based Testing) ---
  // `implemented: false` on every one of these until each phase actually
  // ships real functionality behind it (Phase 1 here is the database
  // foundation only) — flipped to true phase by phase, same as
  // ai_question_generation above was before it existed.
  { key: "cbt", category: "CBT", label: "Online examinations (CBT)", implemented: false },
  { key: "cbt_question_bank", category: "CBT", label: "CBT question bank", implemented: false },
  { key: "cbt_ai_generation", category: "CBT", label: "AI question generation for CBT", implemented: false },
  { key: "cbt_advanced_analytics", category: "CBT", label: "Advanced CBT analytics", implemented: false },

  // --- Operations ---
  { key: "payroll", category: "Operations", label: "Payroll", implemented: true },
  { key: "hr", category: "Operations", label: "HR", implemented: false },
  { key: "library", category: "Operations", label: "Library", implemented: true },
  { key: "transport", category: "Operations", label: "Transport", implemented: true },
  { key: "hostel", category: "Operations", label: "Hostel", implemented: true },
  { key: "inventory", category: "Operations", label: "Inventory", implemented: false },
  { key: "automated_workflows", category: "Operations", label: "Automated workflows", implemented: false },

  // --- Support ---
  { key: "priority_support", category: "Support", label: "Priority support", implemented: false },
] as const;

export type FeatureKey = (typeof FEATURE_CATALOG)[number]["key"];

export const FEATURE_CATEGORIES = [
  "School Management",
  "Academics",
  "Attendance",
  "Finance",
  "Admissions",
  "Communication",
  "Analytics",
  "AI",
  "CBT",
  "Operations",
  "Support",
] as const;

const STARTER_FEATURES: FeatureKey[] = [
  "student_management",
  "parent_management",
  "staff_management",
  "attendance",
  "classes_subjects",
  "timetable",
  "assignments",
  "exams_results",
  "report_cards",
  "announcements",
  "parent_portal",
  "basic_dashboard",
  "basic_ai",
  "email_notifications",
  "cbt",
];

const PROFESSIONAL_ONLY_FEATURES: FeatureKey[] = [
  "advanced_attendance_analytics",
  "advanced_academic_analytics",
  "finance",
  "invoices",
  "receipts",
  "payment_tracking",
  "expenses",
  "admissions",
  "document_management",
  "sms",
  "whatsapp",
  "advanced_parent_communication",
  "ai_report_comments",
  "ai_question_generation",
  "ai_assignment_generation",
  "ai_performance_analysis",
  "ai_school_insights",
  "ai_timetable_assistant",
  "cbt_question_bank",
  "cbt_ai_generation",
];

const PREMIUM_ONLY_FEATURES: FeatureKey[] = [
  "multiple_campuses",
  "payroll",
  "hr",
  "library",
  "transport",
  "hostel",
  "inventory",
  "advanced_finance",
  "advanced_analytics",
  "custom_grading",
  "automated_workflows",
  "advanced_ai",
  "ai_admin_automation",
  "ai_document_processing",
  "priority_support",
  "custom_branding",
  "cbt_advanced_analytics",
];

export const PROFESSIONAL_FEATURES: FeatureKey[] = [...STARTER_FEATURES, ...PROFESSIONAL_ONLY_FEATURES];
export const PREMIUM_FEATURES: FeatureKey[] = [...PROFESSIONAL_FEATURES, ...PREMIUM_ONLY_FEATURES];
export const ENTERPRISE_FEATURES: FeatureKey[] = FEATURE_CATALOG.map((f) => f.key);

export const PLAN_TIER_DEFAULT_FEATURES: Record<"STARTER" | "PROFESSIONAL" | "PREMIUM" | "ENTERPRISE", FeatureKey[]> = {
  STARTER: STARTER_FEATURES,
  PROFESSIONAL: PROFESSIONAL_FEATURES,
  PREMIUM: PREMIUM_FEATURES,
  ENTERPRISE: ENTERPRISE_FEATURES,
};

export function featureListToMap(keys: FeatureKey[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const f of FEATURE_CATALOG) map[f.key] = keys.includes(f.key);
  return map;
}
