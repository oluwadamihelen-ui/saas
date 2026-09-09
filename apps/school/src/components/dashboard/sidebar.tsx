"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Settings,
  BookOpen,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Award,
  Wallet,
  Megaphone,
  MessageSquare,
  Sparkles,
  Banknote,
  Library,
  Bus,
  BedDouble,
  CreditCard,
  IdCard,
  KeyRound,
  UserPlus,
  Contact,
  ClipboardList,
  MessageCircle,
  Archive,
  MonitorCheck,
  ListChecks,
} from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { NavDrawer } from "@/components/ui/nav-drawer";
import { NavTree, type NavItem } from "@/components/ui/nav-tree";

interface DashboardNavItem extends NavItem {
  requiredPermission?: PermissionKey;
  children?: DashboardNavItem[];
}

/// requiredPermission mirrors what each page's own requirePermission()
/// gate actually checks — kept in sync with them on purpose, so the
/// sidebar never offers a link that would just throw "Missing permission"
/// when clicked. No requiredPermission means the page only requires being
/// signed in (requireSchoolUser), so it's shown to every role. A group
/// (has children, no href) is itself invisible once every child is
/// filtered out — see visibleNavFor below.
const NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/students", label: "Students", icon: GraduationCap },
  {
    label: "Administration",
    icon: IdCard,
    children: [
      {
        label: "User",
        icon: Contact,
        children: [
          { href: "/dashboard/staff", label: "Create User", icon: UserPlus, requiredPermission: PERMISSIONS.STAFF_INVITE },
          { href: "/dashboard/administration/users/reset-password", label: "Reset Password", icon: KeyRound, requiredPermission: PERMISSIONS.USERS_MANAGE },
          { href: "/dashboard/academics", label: "Assign Subject & Class", icon: BookOpen, requiredPermission: PERMISSIONS.ACADEMICS_MANAGE },
          { href: "/dashboard/administration/users", label: "All Users", icon: Users, requiredPermission: PERMISSIONS.USERS_MANAGE },
        ],
      },
      {
        label: "Admission",
        icon: ClipboardList,
        children: [
          { href: "/dashboard/administration/admission/fee", label: "Set Admission Fee", icon: Banknote, requiredPermission: PERMISSIONS.ADMISSION_MANAGE },
          { href: "/dashboard/administration/admission", label: "Applicants", icon: ClipboardList, requiredPermission: PERMISSIONS.ADMISSION_VIEW },
        ],
      },
      { href: "/dashboard/staff", label: "Staff", icon: Users },
      {
        label: "Calendar",
        icon: CalendarDays,
        children: [
          { href: "/dashboard/administration/calendar", label: "Calendar", icon: CalendarDays, requiredPermission: PERMISSIONS.CALENDAR_VIEW },
          { href: "/dashboard/administration/calendar/archive", label: "View Archive", icon: Archive, requiredPermission: PERMISSIONS.CALENDAR_VIEW },
        ],
      },
      { href: "/dashboard/administration/feedback", label: "Feedback", icon: MessageCircle, requiredPermission: PERMISSIONS.FEEDBACK_VIEW },
    ],
  },
  { href: "/dashboard/academics", label: "Academics", icon: BookOpen, requiredPermission: PERMISSIONS.ACADEMICS_MANAGE },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, requiredPermission: PERMISSIONS.ATTENDANCE_VIEW },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDays, requiredPermission: PERMISSIONS.TIMETABLE_VIEW },
  { href: "/dashboard/assignments", label: "Assignments", icon: FileText, requiredPermission: PERMISSIONS.ASSIGNMENTS_VIEW },
  { href: "/dashboard/results", label: "Results", icon: Award, requiredPermission: PERMISSIONS.RESULTS_VIEW },
  {
    label: "Exams (CBT)",
    icon: MonitorCheck,
    children: [
      { href: "/dashboard/cbt/question-bank", label: "Question Bank", icon: ListChecks, requiredPermission: PERMISSIONS.CBT_VIEW },
    ],
  },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet, requiredPermission: PERMISSIONS.FINANCE_VIEW },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, requiredPermission: PERMISSIONS.PAYROLL_VIEW },
  { href: "/dashboard/library", label: "Library", icon: Library, requiredPermission: PERMISSIONS.LIBRARY_VIEW },
  { href: "/dashboard/transport", label: "Transport", icon: Bus, requiredPermission: PERMISSIONS.TRANSPORT_VIEW },
  { href: "/dashboard/hostel", label: "Hostel", icon: BedDouble, requiredPermission: PERMISSIONS.HOSTEL_VIEW },
  { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, requiredPermission: PERMISSIONS.ANNOUNCEMENTS_VIEW },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, requiredPermission: PERMISSIONS.MESSAGES_VIEW },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles, requiredPermission: PERMISSIONS.ASSISTANT_USE },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, requiredPermission: PERMISSIONS.BILLING_VIEW },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/// Recursively drops any leaf the user lacks the permission for, then drops
/// any group left with no visible children — a group is never shown just
/// because its own requiredPermission (if any) passed while every child
/// failed.
function filterNav(items: DashboardNavItem[], permSet: Set<string>): DashboardNavItem[] {
  return items.reduce<DashboardNavItem[]>((acc, item) => {
    if (item.requiredPermission && !permSet.has(item.requiredPermission)) return acc;

    if (item.children) {
      const children = filterNav(item.children, permSet);
      if (children.length === 0) return acc;
      acc.push({ ...item, children });
      return acc;
    }

    acc.push(item);
    return acc;
  }, []);
}

function visibleNavFor(perms: string[]): NavItem[] {
  return filterNav(NAV, new Set(perms));
}

/// Mounted separately from Sidebar (not nested inside its `hidden md:flex`
/// aside) so the trigger button and drawer are visible below the md
/// breakpoint. Shares the same permission-filtered nav tree as the desktop
/// sidebar.
export function DashboardMobileNav({ perms, school }: { perms: string[]; school: { name: string; logoUrl: string | null } }) {
  return (
    <NavDrawer
      items={visibleNavFor(perms)}
      homeHref="/dashboard"
      logo={<SchoolLogo name={school.name} logoUrl={school.logoUrl} height={24} />}
    />
  );
}

export function Sidebar({ perms, school }: { perms: string[]; school: { name: string; logoUrl: string | null } }) {
  const visibleNav = visibleNavFor(perms);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard"><SchoolLogo name={school.name} logoUrl={school.logoUrl} height={26} /></Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavTree items={visibleNav} />
      </nav>
    </aside>
  );
}
