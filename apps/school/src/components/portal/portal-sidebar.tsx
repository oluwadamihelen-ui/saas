"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, FileText, Award, ClipboardCheck, Megaphone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const PARENT_NAV = [
  { href: "/portal/parent", label: "My children", icon: Users, exact: true },
  { href: "/portal/parent/announcements", label: "Announcements", icon: Megaphone },
  { href: "/portal/parent/messages", label: "Messages", icon: MessageSquare },
];

const STUDENT_NAV = [
  { href: "/portal/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/portal/student/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/portal/student/assignments", label: "Assignments", icon: FileText },
  { href: "/portal/student/results", label: "Results", icon: Award },
  { href: "/portal/student/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/portal/student/announcements", label: "Announcements", icon: Megaphone },
];

export function PortalSidebar({ role }: { role: "parent" | "student" }) {
  const pathname = usePathname();
  const nav = role === "parent" ? PARENT_NAV : STUDENT_NAV;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href={`/portal/${role}`}><Logo height={26} /></Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
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
