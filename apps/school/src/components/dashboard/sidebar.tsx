"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { NavDrawer } from "@/components/ui/nav-drawer";

/// requiredPermission mirrors what each page's own requirePermission()
/// gate actually checks — kept in sync with them on purpose, so the
/// sidebar never offers a link that would just throw "Missing permission"
/// when clicked. No requiredPermission means the page only requires being
/// signed in (requireSchoolUser), so it's shown to every role.
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; requiredPermission?: PermissionKey }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/students", label: "Students", icon: GraduationCap },
  { href: "/dashboard/academics", label: "Academics", icon: BookOpen, requiredPermission: PERMISSIONS.ACADEMICS_MANAGE },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, requiredPermission: PERMISSIONS.ATTENDANCE_VIEW },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDays, requiredPermission: PERMISSIONS.TIMETABLE_VIEW },
  { href: "/dashboard/assignments", label: "Assignments", icon: FileText, requiredPermission: PERMISSIONS.ASSIGNMENTS_VIEW },
  { href: "/dashboard/results", label: "Results", icon: Award, requiredPermission: PERMISSIONS.RESULTS_VIEW },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet, requiredPermission: PERMISSIONS.FINANCE_VIEW },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, requiredPermission: PERMISSIONS.PAYROLL_VIEW },
  { href: "/dashboard/library", label: "Library", icon: Library, requiredPermission: PERMISSIONS.LIBRARY_VIEW },
  { href: "/dashboard/transport", label: "Transport", icon: Bus, requiredPermission: PERMISSIONS.TRANSPORT_VIEW },
  { href: "/dashboard/hostel", label: "Hostel", icon: BedDouble, requiredPermission: PERMISSIONS.HOSTEL_VIEW },
  { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, requiredPermission: PERMISSIONS.ANNOUNCEMENTS_VIEW },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, requiredPermission: PERMISSIONS.MESSAGES_VIEW },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles, requiredPermission: PERMISSIONS.ASSISTANT_USE },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, requiredPermission: PERMISSIONS.BILLING_VIEW },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function visibleNavFor(perms: string[]) {
  const permSet = new Set(perms);
  return NAV.filter((item) => !item.requiredPermission || permSet.has(item.requiredPermission));
}

/// Mounted separately from Sidebar (not nested inside its `hidden md:flex`
/// aside) so the trigger button and drawer are visible below the md
/// breakpoint. Shares the same permission-filtered nav list as the desktop
/// sidebar.
export function DashboardMobileNav({ perms }: { perms: string[] }) {
  return <NavDrawer items={visibleNavFor(perms)} homeHref="/dashboard" />;
}

export function Sidebar({ perms }: { perms: string[] }) {
  const pathname = usePathname();
  const visibleNav = visibleNavFor(perms);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard"><Logo height={26} /></Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visibleNav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-muted-surface hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
