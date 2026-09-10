import {
  LayoutDashboard,
  Contact,
  CalendarCheck,
  CalendarDays,
  BedDouble,
  LayoutGrid,
  SprayCan,
  Wrench,
  CreditCard,
  FileText,
  Receipt,
  BarChart3,
  UserCog,
  Settings,
  ScrollText,
} from "lucide-react";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";

export interface NavItemDef {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
}

export const APP_NAV_ITEMS: NavItemDef[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/front-desk", label: "Front Desk", icon: Contact, permission: PERMISSIONS.CHECKIN_MANAGE },
  { href: "/app/reservations", label: "Reservations", icon: CalendarCheck, permission: PERMISSIONS.RESERVATIONS_VIEW },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays, permission: PERMISSIONS.RESERVATIONS_VIEW },
  { href: "/app/guests", label: "Guests", icon: Contact, permission: PERMISSIONS.GUESTS_VIEW },
  { href: "/app/rooms", label: "Rooms", icon: BedDouble, permission: PERMISSIONS.ROOMS_VIEW },
  { href: "/app/room-types", label: "Room Types", icon: LayoutGrid, permission: PERMISSIONS.ROOMS_VIEW },
  { href: "/app/housekeeping", label: "Housekeeping", icon: SprayCan, permission: PERMISSIONS.HOUSEKEEPING_VIEW },
  { href: "/app/maintenance", label: "Maintenance", icon: Wrench, permission: PERMISSIONS.MAINTENANCE_VIEW },
  { href: "/app/payments", label: "Payments", icon: CreditCard, permission: PERMISSIONS.PAYMENTS_VIEW },
  { href: "/app/invoices", label: "Invoices", icon: FileText, permission: PERMISSIONS.INVOICES_VIEW },
  { href: "/app/expenses", label: "Expenses", icon: Receipt, permission: PERMISSIONS.EXPENSES_VIEW },
  { href: "/app/reports", label: "Reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/app/staff", label: "Staff", icon: UserCog, permission: PERMISSIONS.STAFF_MANAGE },
  { href: "/app/settings", label: "Settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
  { href: "/app/audit-log", label: "Audit Log", icon: ScrollText, permission: PERMISSIONS.AUDIT_LOG_VIEW },
];
