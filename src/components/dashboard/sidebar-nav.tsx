"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, PlusCircle, FolderKanban, Users2, Image as ImageIcon,
  Mic, Music2, LayoutTemplate, Settings, CreditCard, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "Create Video", icon: PlusCircle },
  { href: "/projects", label: "My Projects", icon: FolderKanban },
  { href: "/characters", label: "Characters", icon: Users2 },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/voices", label: "Voices", icon: Mic },
  { href: "/music", label: "Music", icon: Music2 },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2 font-display text-lg font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient-bg text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        Storyloom
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
              isActive(item.href) && "bg-brand-100 text-brand-700 hover:bg-brand-100 hover:text-brand-700"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
              isActive(item.href) && "bg-brand-100 text-brand-700 hover:bg-brand-100 hover:text-brand-700"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
