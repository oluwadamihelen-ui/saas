"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NavDrawer } from "@/components/ui/nav-drawer";

const NAV = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/schools", label: "Schools", icon: Building2 },
  { href: "/platform/plans", label: "Plans", icon: Package },
];

/// Mounted separately from PlatformSidebar (not nested inside its
/// `hidden md:flex` aside) so the trigger button and drawer are visible
/// below the md breakpoint — same pattern as DashboardMobileNav/
/// PortalMobileNav.
export function PlatformMobileNav() {
  return <NavDrawer items={NAV} homeHref="/platform" />;
}

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Link href="/platform"><Logo height={26} /></Link>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Platform</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
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
