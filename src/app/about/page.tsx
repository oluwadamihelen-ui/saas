import Link from "next/link";
import { Building2, Target, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "About — Otelum" };

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="container-shell flex flex-col gap-4 py-16 text-center">
            <span className="mx-auto rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">About Otelum</span>
            <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Built by people who wanted hotel software that just works
            </h1>
            <p className="mx-auto max-w-xl text-base text-muted">
              Otelum is a product of Numi Innovations LTD, built to replace spreadsheets and disconnected tools with
              one system for the day-to-day work of running a hotel.
            </p>
          </div>
        </section>

        <section className="container-shell grid gap-8 py-16 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
              <Target className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Our focus</h2>
            <p className="text-sm text-muted">
              Front desk, housekeeping, maintenance, payments and reporting for independent hotels and small groups —
              not a bloated enterprise system built for chains with dedicated IT teams.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Data isolation</h2>
            <p className="text-sm text-muted">
              Every property&apos;s reservations, guests and financial records are scoped and isolated server-side —
              one hotel can never see another&apos;s data, even within the same group.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Numi Innovations LTD</h2>
            <p className="text-sm text-muted">
              Otelum is developed and operated by Numi Innovations LTD. For partnership, press or support inquiries,{" "}
              <Link href="/contact" className="text-accent hover:underline">
                get in touch
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-border bg-surface py-16">
          <div className="container-shell flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-foreground">Ready to see it running your front desk?</h2>
            <Button asChild size="lg">
              <Link href="/register">Register your hotel</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
