"use client";

import Link from "next/link";
import { LayoutDashboard, Building2, Package, LineChart, Inbox } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavDrawer } from "@/components/ui/nav-drawer";
import { NavTree, type NavItem } from "@/components/ui/nav-tree";

const NAV: NavItem[] = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/schools", label: "Schools", icon: Building2 },
  { href: "/platform/plans", label: "Plans", icon: Package },
  { href: "/platform/billing", label: "Billing", icon: LineChart },
  { href: "/platform/inquiries", label: "Enterprise inquiries", icon: Inbox },
];

/// Mounted separately from PlatformSidebar (not nested inside its
/// `hidden md:flex` aside) so the trigger button and drawer are visible
/// below the md breakpoint — same pattern as DashboardMobileNav/
/// PortalMobileNav.
export function PlatformMobileNav() {
  return <NavDrawer items={NAV} homeHref="/platform" />;
}

export function PlatformSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-navy md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-navy-border px-6">
        <Link href="/platform"><Logo height={26} variant="light" /></Link>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white">Platform</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavTree items={NAV} theme="navy" />
      </nav>
    </aside>
  );
}
