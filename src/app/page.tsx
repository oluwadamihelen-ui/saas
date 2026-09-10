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
        {/* Hero — dark navy band (matches the sidebar/auth brand surface),
            not a tinted-light hero, so the homepage reads as its own
            product from the first screen. */}
        <section className="relative overflow-hidden bg-navy pb-24 pt-16 sm:pb-32 sm:pt-24 lg:pb-40 lg:pt-28">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-accent/25 blur-[110px]" />
            <div className="absolute -right-24 top-24 h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-[110px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
          </div>

          <div className="container-shell">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-navy-border bg-white/5 px-3.5 py-1.5 text-xs font-medium text-navy-muted backdrop-blur-sm">
                  Built for modern schools across Africa
                </span>
              </Reveal>
              <Reveal delayMs={80}>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Run your entire school
                  <br className="hidden sm:block" /> with Schoolum.
                </h1>
              </Reveal>
              <Reveal delayMs={140}>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-navy-muted">
                  Schoolum brings students, teachers, parents, academics, finance, communication and AI-powered
                  insights together in one intelligent school management platform.
                </p>
              </Reveal>
              <Reveal delayMs={200}>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/register">Start Free Trial</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                    <Link href="/contact">
                      Book a Demo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <p className="mt-5 text-sm text-navy-muted">No complicated setup. Get your school running quickly.</p>
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
