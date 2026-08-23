import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { CheckoutButton } from "@/components/CheckoutButton";
import { Footer } from "@/components/Footer";

function formatPrice(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

export default async function PricingPage() {
  const session = await auth();
  const isAuthenticated = Boolean((session?.user as { id?: string } | undefined)?.id);

  const plans = await prisma.plan.findMany({ where: { isPubliclyVisible: true }, orderBy: { sortOrder: "asc" } });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">Unlimited AI Movie Creation</h1>
          <p className="mt-3 text-cinerra-muted">
            No credits. No generation counters. Every plan gives you unlimited movie creation, subject to a fair-use
            concurrency limit — how many generations can run for you at once.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {plans.map((plan, i) => {
            const isPopular = plans.length > 1 && i === 1;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-5 shadow-card backdrop-blur-sm transition ${
                  isPopular
                    ? "border-cinerra-gold/50 bg-cinerra-surface shadow-glow-gold"
                    : "border-cinerra-border/80 bg-cinerra-surface/90 hover:border-cinerra-border"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cinerra-gold px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#26180a]">
                    Most Popular
                  </span>
                )}
                <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
                <p className="mt-1 text-sm text-cinerra-muted">{plan.description}</p>
                <div className="mt-6">
                  <span className="text-3xl font-bold">{formatPrice(plan.priceMonthlyCents)}</span>
                  <span className="text-sm text-cinerra-muted">/mo</span>
                  {plan.priceYearlyCents > 0 && (
                    <p className="mt-1 text-xs text-cinerra-muted">
                      or {formatPrice(plan.priceYearlyCents)}/yr ({Math.round(100 - (plan.priceYearlyCents / 12 / plan.priceMonthlyCents) * 100)}% off)
                    </p>
                  )}
                </div>
                <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm text-cinerra-muted">
                  <li>Unlimited AI movie creation</li>
                  <li>{plan.maxConcurrentGenerations} simultaneous generation{plan.maxConcurrentGenerations > 1 ? "s" : ""}</li>
                  <li>{plan.queuePriority.toLowerCase()} queue priority</li>
                  <li>Up to {plan.maxExportResolution} export</li>
                  <li>{plan.maxStorageGB} GB storage</li>
                  {plan.seats > 1 && <li>{plan.seats} team seats</li>}
                </ul>
                {isAuthenticated ? (
                  <CheckoutButton planKey={plan.key} disabled={plan.priceMonthlyCents === 0} />
                ) : (
                  <a href="/signup" className={isPopular ? "btn-gold mt-6 w-full" : "btn-primary mt-6 w-full"}>
                    Get started
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
