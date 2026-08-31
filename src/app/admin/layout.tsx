import Link from "next/link";
import { MamaLogo } from "@/components/brand/logo";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/payout-requests", label: "Payout requests" },
  { href: "/admin/system", label: "System" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MamaLogo className="text-lg" />
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Admin</span>
          </div>
          <nav className="flex gap-1 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Exit admin
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
