"use client";

import Link from "next/link";
import { LayoutDashboard, Users, CalendarDays, FileText, Award, ClipboardCheck, Megaphone, MessageSquare, MessageCircle } from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { NavDrawer } from "@/components/ui/nav-drawer";
import { NavTree, type NavItem } from "@/components/ui/nav-tree";

const PARENT_NAV: NavItem[] = [
  { href: "/portal/parent", label: "My children", icon: Users, exact: true },
  { href: "/portal/parent/announcements", label: "Announcements", icon: Megaphone },
  { href: "/portal/parent/messages", label: "Messages", icon: MessageSquare },
  { href: "/portal/parent/feedback", label: "Feedback", icon: MessageCircle },
];

const STUDENT_NAV: NavItem[] = [
  { href: "/portal/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/portal/student/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/portal/student/assignments", label: "Assignments", icon: FileText },
  { href: "/portal/student/results", label: "Results", icon: Award },
  { href: "/portal/student/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/portal/student/announcements", label: "Announcements", icon: Megaphone },
  { href: "/portal/student/feedback", label: "Feedback", icon: MessageCircle },
];

interface SchoolBrief {
  name: string;
  logoUrl: string | null;
}

/// Mounted separately from PortalSidebar (not nested inside its
/// `hidden md:flex` aside) so the trigger button and drawer are visible
/// below the md breakpoint.
export function PortalMobileNav({ role, school }: { role: "parent" | "student"; school: SchoolBrief }) {
  const nav = role === "parent" ? PARENT_NAV : STUDENT_NAV;
  return (
    <NavDrawer items={nav} homeHref={`/portal/${role}`} logo={<SchoolLogo name={school.name} logoUrl={school.logoUrl} height={24} />} />
  );
}

export function PortalSidebar({ role, school }: { role: "parent" | "student"; school: SchoolBrief }) {
  const nav = role === "parent" ? PARENT_NAV : STUDENT_NAV;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href={`/portal/${role}`}><SchoolLogo name={school.name} logoUrl={school.logoUrl} height={26} /></Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavTree items={nav} />
      </nav>
    </aside>
  );
}
