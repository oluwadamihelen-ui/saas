import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";
import { HeroDashboardPreview } from "@/components/marketing/hero-dashboard-preview";
import { TrustStats } from "@/components/marketing/trust-stats";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { WhySchoolum } from "@/components/marketing/why-schoolum";
import { SecuritySection } from "@/components/marketing/security-section";
import { FinalCta } from "@/components/marketing/final-cta";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20 lg:pb-36 lg:pt-24">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-[36rem] bg-gradient-to-b from-accent-soft/70 via-background to-background"
          />
          <div className="container-shell">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted shadow-sm">
                  Built for modern schools across Africa
                </span>
              </Reveal>
              <Reveal delayMs={80}>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Everything your school needs.
                  <br className="hidden sm:block" /> In one place.
                </h1>
              </Reveal>
              <Reveal delayMs={140}>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
                  Schoolum brings students, staff, academics, attendance, finance and communication together in one
                  powerful school management platform.
                </p>
              </Reveal>
              <Reveal delayMs={200}>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/register">Get started</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                    <a href="#product">
                      Explore the platform
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="mt-5 text-sm text-muted">No complicated setup. Get your school running quickly.</p>
              </Reveal>
            </div>

            <Reveal delayMs={280} className="mt-16 sm:mt-20 lg:mt-24">
              <HeroDashboardPreview />
            </Reveal>
          </div>
        </section>

        <TrustStats />
        <FeatureGrid />
        <ProductShowcase />
        <HowItWorks />
        <WhySchoolum />
        <SecuritySection />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}
