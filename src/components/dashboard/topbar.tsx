"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, Zap, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects/new", label: "Create Video" },
  { href: "/projects", label: "My Projects" },
  { href: "/characters", label: "Characters" },
  { href: "/assets", label: "Assets" },
  { href: "/voices", label: "Voices" },
  { href: "/music", label: "Music" },
  { href: "/templates", label: "Templates" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
];

export function Topbar({
  userName,
  creditBalance,
}: {
  userName: string;
  creditBalance: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden md:block" />

        <div className="flex items-center gap-3">
          <Link
            href="/billing"
            className="flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted px-3 py-1.5 text-sm font-medium"
          >
            <Zap className="h-3.5 w-3.5 text-ember-500" />
            {creditBalance} credits
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium">{userName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/" })} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient-bg text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                Storyloom
              </Link>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                    pathname === item.href && "bg-brand-100 text-brand-700"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
