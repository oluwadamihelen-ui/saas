"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import { MamaLogo } from "@/components/brand/logo";
import { SIDEBAR_NAV } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

export function Sidebar({ businessName, isPlatformAdmin }: { businessName: string; isPlatformAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <MamaLogo className="text-lg" />
      </div>
      <div className="px-6 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business</p>
        <p className="mt-0.5 truncate font-semibold">{businessName}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {SIDEBAR_NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {isPlatformAdmin && (
        // /admin has its own separate layout (src/app/admin/layout.tsx), so
        // this link always navigates away from the dashboard shell entirely
        // — it's never the "active" item while this sidebar is rendered.
        <div className="border-t border-border px-3 py-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <ShieldCheck className="h-4 w-4" /> Admin panel
          </Link>
        </div>
      )}
      <div className="border-t border-border p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </aside>
  );
}
