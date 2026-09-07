import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Bundles" };

export default async function BundlesPage() {
  const bundles = await prisma.bundle.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { application: true, hostingPlan: true } } },
  });

  return (
    <div className="container-shell py-14">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Bundles</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Curated packages of apps, hosting, and services at one flat price — save more than buying each piece separately.
        </p>
      </div>

      {bundles.length === 0 ? (
        <div className="mt-12">
          <EmptyState icon={<Layers className="h-8 w-8" />} title="No bundles available right now" description="Check back soon — new bundles are added regularly." />
        </div>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="flex flex-col rounded-lg border border-border bg-surface p-6">
              <h3 className="text-lg font-semibold text-foreground">{bundle.name}</h3>
              {bundle.description && <p className="mt-1 text-sm text-muted">{bundle.description}</p>}
              <p className="mt-4 text-3xl font-semibold text-foreground">{formatCurrency(Number(bundle.price), bundle.currency)}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-muted">
                {bundle.items.map((item) => (
                  <li key={item.id}>
                    {item.type === "APPLICATION" && item.application?.name}
                    {item.type === "HOSTING_PLAN" && `${item.hostingPlan?.name} Hosting`}
                    {(item.type === "SERVICE" || item.type === "DOMAIN") && item.serviceLabel}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full">
                <Link href={`/bundles/${bundle.slug}`}>View Bundle</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
