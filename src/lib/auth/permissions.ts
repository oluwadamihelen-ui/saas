import { RoleKey } from "@/generated/prisma/enums";

// Canonical permission catalog for hotel-scoped operations. Seeded into the
// Permission table and wired to roles via RolePermission (role -> default
// grants) so access control is data-driven: a Hotel Owner can revoke a
// single receptionist's ability to manage rooms without a code change
// (UserPermission override, scoped to hotelId + userId).
export const PERMISSIONS = {
  RESERVATIONS_VIEW: "reservations.view",
  RESERVATIONS_MANAGE: "reservations.manage",
  CHECKIN_MANAGE: "checkin.manage",
  GUESTS_VIEW: "guests.view",
  GUESTS_MANAGE: "guests.manage",
  ROOMS_VIEW: "rooms.view",
  ROOMS_MANAGE: "rooms.manage",
  HOUSEKEEPING_VIEW: "housekeeping.view",
  HOUSEKEEPING_MANAGE: "housekeeping.manage",
  MAINTENANCE_VIEW: "maintenance.view",
  MAINTENANCE_MANAGE: "maintenance.manage",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_MANAGE: "payments.manage",
  INVOICES_VIEW: "invoices.view",
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_MANAGE: "expenses.manage",
  REPORTS_VIEW: "reports.view",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_LOG_VIEW: "audit_log.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: { key: PermissionKey; category: string; description: string }[] = [
  { key: PERMISSIONS.RESERVATIONS_VIEW, category: "Reservations", description: "View reservations and the calendar" },
  { key: PERMISSIONS.RESERVATIONS_MANAGE, category: "Reservations", description: "Create, edit, cancel and extend reservations" },
  { key: PERMISSIONS.CHECKIN_MANAGE, category: "Front Desk", description: "Check guests in and out, transfer rooms" },
  { key: PERMISSIONS.GUESTS_VIEW, category: "Guests", description: "View guest profiles and history" },
  { key: PERMISSIONS.GUESTS_MANAGE, category: "Guests", description: "Create and edit guest records" },
  { key: PERMISSIONS.ROOMS_VIEW, category: "Rooms", description: "View rooms, room types and availability" },
  { key: PERMISSIONS.ROOMS_MANAGE, category: "Rooms", description: "Create, edit rooms/room types and change room status" },
  { key: PERMISSIONS.HOUSEKEEPING_VIEW, category: "Housekeeping", description: "View housekeeping tasks" },
  { key: PERMISSIONS.HOUSEKEEPING_MANAGE, category: "Housekeeping", description: "Create and update housekeeping tasks" },
  { key: PERMISSIONS.MAINTENANCE_VIEW, category: "Maintenance", description: "View maintenance requests" },
  { key: PERMISSIONS.MAINTENANCE_MANAGE, category: "Maintenance", description: "Create and update maintenance requests" },
  { key: PERMISSIONS.PAYMENTS_VIEW, category: "Billing", description: "View payments" },
  { key: PERMISSIONS.PAYMENTS_MANAGE, category: "Billing", description: "Record and refund payments" },
  { key: PERMISSIONS.INVOICES_VIEW, category: "Billing", description: "View and download invoices" },
  { key: PERMISSIONS.EXPENSES_VIEW, category: "Billing", description: "View expenses" },
  { key: PERMISSIONS.EXPENSES_MANAGE, category: "Billing", description: "Record and edit expenses" },
  { key: PERMISSIONS.REPORTS_VIEW, category: "Reports", description: "View hotel reports and analytics" },
  { key: PERMISSIONS.STAFF_MANAGE, category: "Administration", description: "Manage staff accounts and permissions" },
  { key: PERMISSIONS.SETTINGS_MANAGE, category: "Administration", description: "Configure hotel settings" },
  { key: PERMISSIONS.AUDIT_LOG_VIEW, category: "Administration", description: "View the audit log" },
];

const ALL_PERMISSIONS = PERMISSION_CATALOG.map((p) => p.key);

// Default permission grants per hotel role. SUPER_ADMIN is intentionally
// absent -- it is a platform-level flag (User.isSuperAdmin), never a
// HotelMember role, and platform admins bypass hotel permission checks
// entirely (see requirePermission()).
export const ROLE_DEFAULT_PERMISSIONS: Record<Exclude<RoleKey, "SUPER_ADMIN">, PermissionKey[]> = {
  HOTEL_OWNER: ALL_PERMISSIONS,
  HOTEL_MANAGER: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.SETTINGS_MANAGE),
  RECEPTIONIST: [
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.RESERVATIONS_MANAGE,
    PERMISSIONS.CHECKIN_MANAGE,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.GUESTS_MANAGE,
    PERMISSIONS.ROOMS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_MANAGE,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.HOUSEKEEPING_VIEW,
    PERMISSIONS.MAINTENANCE_VIEW,
  ],
  ACCOUNTANT: [
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_MANAGE,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  HOUSEKEEPING: [PERMISSIONS.ROOMS_VIEW, PERMISSIONS.HOUSEKEEPING_VIEW, PERMISSIONS.HOUSEKEEPING_MANAGE],
  MAINTENANCE: [PERMISSIONS.ROOMS_VIEW, PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.MAINTENANCE_MANAGE],
  STAFF: [PERMISSIONS.RESERVATIONS_VIEW, PERMISSIONS.ROOMS_VIEW, PERMISSIONS.GUESTS_VIEW],
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  HOTEL_OWNER: "Hotel Owner",
  HOTEL_MANAGER: "Hotel Manager",
  RECEPTIONIST: "Receptionist",
  ACCOUNTANT: "Accountant",
  HOUSEKEEPING: "Housekeeping Staff",
  MAINTENANCE: "Maintenance Staff",
  STAFF: "Staff",
};

export const HOTEL_ROLE_KEYS = Object.keys(ROLE_LABELS).filter((k) => k !== "SUPER_ADMIN") as Exclude<RoleKey, "SUPER_ADMIN">[];
