"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, BookOpen, Calculator, FlaskConical, Gauge, LayoutDashboard, Library, Menu, Settings, ShieldCheck, Store, Wallet, Wrench, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";
import { setActiveAccountAction } from "@/actions/account";

export const NAV_GROUPS = [
  { title: "Risk", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/rules", label: "Risk Rules", icon: ShieldCheck },
    { href: "/accounts", label: "Accounts", icon: Wallet },
  ] },
  { title: "Journal", items: [
    { href: "/journal", label: "Journal", icon: BookOpen },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { title: "Research", items: [{ href: "/lab", label: "Indicator Lab", icon: FlaskConical }] },
  { title: "Marketplace", items: [
    { href: "/market", label: "Browse", icon: Store },
    { href: "/library", label: "My Indicators", icon: Library },
    { href: "/creator", label: "Creator", icon: Wrench },
  ] },
  { title: "TradingView", items: [{ href: "/tradingview", label: "TradingView Tools", icon: Gauge }] },
  { title: "Account", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];
export const NAV = NAV_GROUPS.flatMap((g) => g.items);

function useActive() {
  const p = usePathname();
  return (href: string) => p === href || p.startsWith(href + "/");
}

export function Sidebar({ plan, isAdmin }: { plan: "FREE" | "PRO"; isAdmin?: boolean }) {
  const active = useActive();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/50 p-3 lg:flex">
      <Link href="/dashboard" className="px-2 py-3"><Logo /></Link>
      <nav className="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
        {NAV_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted/70">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg", active(href) && "bg-accent-soft text-fg")}>
                  <Icon size={15} className={active(href) ? "text-accent" : ""} />{label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {isAdmin && <Link href="/admin" className={cn("flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-warn hover:bg-surface-2", active("/admin") && "bg-warn-soft")}><Lock size={15} />Admin</Link>}
      </nav>
      <Link href="/billing" className="rounded-lg border border-line bg-surface-2 p-3 text-xs">
        <span className="font-semibold">{plan === "PRO" ? "Pro plan" : "Free plan"}</span>
        <span className="mt-0.5 block text-muted">{plan === "PRO" ? "Manage billing" : "Upgrade for unlimited trades & more"}</span>
      </Link>
    </aside>
  );
}

export function MobileBar() {
  const active = useActive();
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/dashboard"><Logo /></Link>
        <details className="relative">
          <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg border border-line" aria-label="Menu"><Menu size={18} /></summary>
          <nav className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", active(href) ? "bg-accent-soft" : "text-muted")}><Icon size={16} />{label}</Link>
            ))}
            <Link href="/billing" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted">Plan & billing</Link>
          </nav>
        </details>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg/95 backdrop-blur lg:hidden" aria-label="Primary">
        {NAV.filter((n) => ["/dashboard", "/calculator", "/journal", "/lab"].includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", active(href) ? "text-accent" : "text-muted")}><Icon size={18} />{label}</Link>
        ))}
      </nav>
    </>
  );
}

export function AccountSwitcher({ accounts, activeId }: { accounts: { id: string; name: string; currency: string }[]; activeId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      aria-label="Active trading account"
      value={activeId}
      disabled={pending || accounts.length < 2}
      onChange={(e) => start(async () => { await setActiveAccountAction(e.target.value); router.refresh(); })}
      className="h-9 max-w-48 rounded-lg border border-line bg-surface px-2.5 text-sm"
    >
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
    </select>
  );
}
