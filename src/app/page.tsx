import Link from "next/link";
import { BedDouble, CalendarCheck, ClipboardList, CreditCard, LayoutDashboard, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: CalendarCheck, title: "Reservations & availability", description: "Real-time room availability with automatic double-booking prevention." },
  { icon: BedDouble, title: "Rooms & housekeeping", description: "Track room status from dirty to inspected, and assign cleaning tasks." },
  { icon: CreditCard, title: "Payments & folios", description: "Partial payments, guest folios, and professional PDF invoices." },
  { icon: ClipboardList, title: "Front desk operations", description: "Arrivals, departures, walk-ins and check-in/out in one screen." },
  { icon: Wrench, title: "Maintenance tracking", description: "Report and resolve issues without taking rooms out of service unnecessarily." },
  { icon: LayoutDashboard, title: "Reports that matter", description: "Occupancy, revenue and outstanding balances, computed from real bookings." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="container-shell flex h-16 items-center justify-between">
          <Logo height={30} />
          <nav className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Register your hotel</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="container-shell flex flex-col items-center gap-6 py-20 text-center">
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
              Multi-property hotel management, built for daily operations
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Run your hotel&apos;s front desk, rooms and revenue from one system
            </h1>
            <p className="max-w-xl text-base text-muted">
              StayOS handles reservations, check-in/check-out, housekeeping, maintenance, payments and reporting —
              with each property&apos;s data fully isolated from every other.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">Get started free</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/login">Sign in to your hotel</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container-shell py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
                    <f.icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="container-shell flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} StayOS. All rights reserved.</span>
          <Link href="/login" className="text-accent">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
