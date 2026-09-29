"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import type { NavItem } from "@/components/dashboard/sidebar-nav";

export function DashboardTopbar({ name, email, navItems }: { name: string; email: string; navItems: NavItem[] }) {
  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b border-border bg-surface px-3 sm:px-6">
      <MobileNav items={navItems} basePath="/super" badge="Super Admin" />
      <div className="flex shrink-0 items-center gap-1 sm:gap-4">
        <div className="hidden text-right sm:block">
          <p className="max-w-40 truncate sm:max-w-56 lg:max-w-72 text-sm font-medium text-foreground">{name}</p>
          <p className="max-w-40 truncate sm:max-w-56 lg:max-w-72 text-xs text-muted">{email}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
