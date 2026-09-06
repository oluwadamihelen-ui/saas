import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Hosting" };

export default async function HostingPage() {
  const plans = await prisma.hostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

  return (
    <div className="container-shell py-14">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Managed Hosting</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Reliable hosting plans provisioned automatically when you deploy through the platform.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-lg border p-6 ${i === 1 ? "border-accent shadow-md" : "border-border"} bg-surface`}
          >
            {i === 1 && (
              <span className="mb-3 w-fit rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                Most Popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted">{plan.description}</p>
            <p className="mt-4 text-3xl font-semibold text-foreground">
              {plan.isCustom ? "Custom" : formatCurrency(Number(plan.priceMonthly))}
              {!plan.isCustom && <span className="text-sm font-normal text-muted">/mo</span>}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              <li className="flex items-center gap-2 text-muted">
                <Check className="h-4 w-4 text-success" /> {plan.websitesLimit} website{plan.websitesLimit > 1 ? "s" : ""}
              </li>
              <li className="flex items-center gap-2 text-muted">
                <Check className="h-4 w-4 text-success" /> {plan.storageGB}GB storage
              </li>
              <li className="flex items-center gap-2 text-muted">
                <Check className="h-4 w-4 text-success" /> {plan.bandwidthGB}GB bandwidth
              </li>
              <li className="flex items-center gap-2 text-muted">
                <Check className="h-4 w-4 text-success" /> {plan.databasesLimit} database{plan.databasesLimit > 1 ? "s" : ""}
              </li>
            </ul>
            <Button className="mt-6 w-full" variant={i === 1 ? "primary" : "secondary"} asChild>
              <Link href="/apps">Choose Plan</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
