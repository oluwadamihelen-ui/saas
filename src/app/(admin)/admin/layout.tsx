import Link from "next/link";
import { Lock } from "lucide-react";
import { Logo } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

const LINKS = [["/admin", "Overview"], ["/admin/listings", "Listings"], ["/admin/creators", "Creators"], ["/admin/reports", "Reports"], ["/admin/orders", "Orders & refunds"], ["/admin/payouts", "Payouts"], ["/admin/settings", "Settings"], ["/admin/audit", "Audit log"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // non-admins get a 404 — the panel's existence isn't revealed
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3"><Logo /><span className="flex items-center gap-1 rounded-md bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn"><Lock size={12} /> Admin</span></Link>
          <nav className="flex flex-wrap gap-1 text-sm">{LINKS.map(([h, l]) => <Link key={h} href={h} className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-fg">{l}</Link>)}</nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
