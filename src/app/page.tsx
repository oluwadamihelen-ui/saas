import Link from "next/link";
import {
  BedDouble,
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/marketing/site-footer";

const FEATURES = [
  { icon: CalendarCheck, title: "Reservations & availability", description: "Real-time room availability with automatic double-booking prevention." },
  { icon: BedDouble, title: "Rooms & housekeeping", description: "Track room status from dirty to inspected, and assign cleaning tasks." },
  { icon: CreditCard, title: "Payments & folios", description: "Partial payments, guest folios, and professional PDF invoices." },
  { icon: ClipboardList, title: "Front desk operations", description: "Arrivals, departures, walk-ins and check-in/out in one screen." },
  { icon: Wrench, title: "Maintenance tracking", description: "Report and resolve issues without taking rooms out of service unnecessarily." },
  { icon: LayoutDashboard, title: "Reports that matter", description: "Occupancy, revenue and outstanding balances, computed from real bookings." },
  { icon: Building2, title: "Multi-property groups", description: "Run several hotels from one login, with each property's data kept fully separate." },
  { icon: UserCog, title: "Staff roles & permissions", description: "Give front desk, housekeeping and managers exactly the access they need — no more." },
  { icon: ShieldCheck, title: "Per-hotel data isolation", description: "Every query is scoped server-side to the signed-in user's hotel. No cross-hotel leaks." },
];

const STEPS = [
  {
    number: "01",
    title: "Register your hotel",
    description: "Create your account and set up your property — rooms, room types and rates — in minutes.",
  },
  {
    number: "02",
    title: "Add your staff",
    description: "Invite front desk, housekeeping and managers, and give each role exactly the access it needs.",
  },
  {
    number: "03",
    title: "Run your front desk",
    description: "Take reservations, check guests in and out, and track housekeeping and maintenance from one screen.",
  },
  {
    number: "04",
    title: "See it in your reports",
    description: "Occupancy, revenue and outstanding balances — computed live from what actually happened at the desk.",
  },
];

const FAQS = [
  {
    question: "Is my hotel's data isolated from other hotels?",
    answer:
      "Yes. Otelum is multi-tenant by design — every reservation, guest, payment and report is scoped server-side to your hotel. Staff at one property can never see another property's data, even within the same group.",
  },
  {
    question: "Can I run more than one hotel from a single account?",
    answer:
      "Yes. If you manage a group of properties, you can switch between hotels from the same login, and each hotel's operations and financials stay separate.",
  },
  {
    question: "What roles and permissions can I set up for staff?",
    answer:
      "You can add staff with roles like front desk, housekeeping, maintenance and manager, and control what each role can see and do — from taking reservations to viewing financial reports.",
  },
  {
    question: "Does Otelum handle payments and invoices?",
    answer:
      "Yes. You can record partial or full payments against a guest's folio and generate professional PDF invoices directly from a reservation.",
  },
  {
    question: "Who is behind Otelum?",
    answer:
      "Otelum is built and operated by Numi Innovations LTD. You can read more on our About page, or reach us any time at hello@otelum.io.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="container-shell flex h-16 items-center justify-between">
          <Logo height={30} />
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="text-sm text-muted hover:text-foreground">
              FAQ
            </a>
            <Link href="/about" className="text-sm text-muted hover:text-foreground">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Register your hotel</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-surface">
          <div className="container-shell flex flex-col items-center gap-6 py-20 text-center">
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
              Multi-property hotel management, built for daily operations
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Run your hotel&apos;s front desk, rooms and revenue from one system
            </h1>
            <p className="max-w-xl text-base text-muted">
              Otelum handles reservations, check-in/check-out, housekeeping, maintenance, payments and reporting —
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

        {/* Features */}
        <section id="features" className="scroll-mt-16 container-shell py-16">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Everything your front desk needs, in one place
            </h2>
            <p className="mt-3 text-sm text-muted">
              No spreadsheets, no disconnected tools — one system for the work that actually happens at your hotel
              every day.
            </p>
          </div>
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

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-t border-border bg-surface py-16">
          <div className="container-shell">
            <div className="mx-auto mb-10 max-w-xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Up and running in an afternoon</h2>
              <p className="mt-3 text-sm text-muted">From registering your hotel to your first check-in.</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.number} className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-accent">{step.number}</span>
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data isolation / security highlight */}
        <section className="border-t border-border py-16">
          <div className="container-shell grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
                <ShieldCheck className="h-5 w-5 text-accent" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Built multi-tenant from day one
              </h2>
              <p className="text-sm text-muted">
                Every reservation, guest record, payment and report in Otelum is tied to a hotel, and every database
                query is scoped server-side to the signed-in user&apos;s hotel membership — never trusted from the
                client. If you run more than one property, each one&apos;s data stays fully separate, even though
                you can switch between them from a single login.
              </p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Role-based permissions for front desk, housekeeping, maintenance and managers
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Passwords hashed, never stored in plain text
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Full audit trail on reservations, payments and status changes
                </li>
              </ul>
            </div>
            <Card>
              <CardContent className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">A hotel group, on Otelum</p>
                <div className="space-y-2">
                  {["Sunrise Hotel — Lagos", "Harbor View Suites — Accra", "Lakeside Retreat — Nairobi"].map((hotel) => (
                    <div key={hotel} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm">
                      <span className="font-medium text-foreground">{hotel}</span>
                      <span className="text-xs text-muted">Isolated data</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* About / company teaser */}
        <section className="border-t border-border bg-surface py-16">
          <div className="container-shell flex flex-col items-center gap-4 text-center">
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">A product of Numi Innovations LTD</span>
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Made for hoteliers, by a team that builds software for real operations
            </h2>
            <p className="max-w-lg text-sm text-muted">
              Otelum is developed and operated by Numi Innovations LTD, focused on giving independent hotels and
              small groups software that matches how they actually work.
            </p>
            <Button asChild variant="secondary">
              <Link href="/about">Learn more about us</Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 container-shell py-16">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Frequently asked questions</h2>
          </div>
          <div className="mx-auto max-w-2xl divide-y divide-border rounded-lg border border-border bg-surface">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
                  {faq.question}
                  <span className="shrink-0 text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border bg-surface py-16">
          <div className="container-shell flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Ready to run your front desk from one screen?
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">Get started free</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
