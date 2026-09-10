import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { listPlans } from "@/lib/services/platform";
import { PricingCards } from "./pricing-cards";

export const metadata = { title: "Pricing — Schoolum" };

export default async function PricingPage() {
  const allPlans = await listPlans();
  const plans = allPlans
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      priceMonthlyMinor: p.priceMonthlyMinor,
      priceAnnualMinor: p.priceAnnualMinor,
      currency: p.currency,
      isCustomPricing: p.isCustomPricing,
      studentLimit: p.studentLimit,
      isMostPopular: p.isMostPopular,
      features: (p.features as Record<string, boolean>) ?? {},
    }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container-shell flex items-center justify-between py-6">
        <Link href="/"><Logo height={32} /></Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="container-shell flex-1 py-12">
        <div className="mx-auto max-w-2xl space-y-4 pb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Simple, transparent pricing</h1>
          <p className="text-lg text-muted">
            Every plan includes a 14-day free trial with full Professional-tier access — no card required. Cancel anytime.
          </p>
        </div>

        {plans.length === 0 ? (
          <p className="text-center text-muted">Pricing is being updated — check back shortly.</p>
        ) : (
          <PricingCards plans={plans} />
        )}
      </main>

      <footer className="container-shell border-t border-border py-8 text-center text-sm text-muted">
        &copy; {new Date().getFullYear()} Schoolum. Built for African schools.
      </footer>
    </div>
  );
}
