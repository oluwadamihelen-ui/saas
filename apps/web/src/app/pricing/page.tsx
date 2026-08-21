import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/Nav";
import { CheckoutButton } from "@/components/CheckoutButton";

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
          <h1 className="font-display text-3xl font-bold md:text-4xl">Unlimited AI Movie Creation</h1>
          <p className="mt-3 text-cinerra-muted">
            No credits. No generation counters. Every plan gives you unlimited movie creation, subject to a fair-use
            concurrency limit — how many generations can run for you at once.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.id} className="card flex flex-col">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
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
                <a href="/signup" className="mt-6 rounded-full bg-cinerra-accent py-2.5 text-center text-sm font-semibold text-white hover:brightness-110">
                  Get started
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
