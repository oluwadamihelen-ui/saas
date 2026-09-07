import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await prisma.bundle.findFirst({ where: { slug, isActive: true } });
  return { title: bundle?.name ?? "Bundle" };
}

export default async function BundleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await prisma.bundle.findFirst({
    where: { slug, isActive: true },
    include: { items: { include: { application: true, hostingPlan: true } } },
  });
  if (!bundle) notFound();

  return (
    <div className="container-shell py-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{bundle.name}</h1>
          {bundle.description && <p className="mt-3 text-muted">{bundle.description}</p>}

          <div className="mt-8 rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-foreground">What&apos;s included</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {bundle.items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    {item.type === "APPLICATION" && item.application?.name}
                    {item.type === "HOSTING_PLAN" && `${item.hostingPlan?.name} Hosting`}
                    {(item.type === "SERVICE" || item.type === "DOMAIN") && item.serviceLabel}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="text-3xl font-semibold text-foreground">{formatCurrency(Number(bundle.price), bundle.currency)}</p>
            <p className="mt-1 text-sm text-muted">One-time payment for everything above.</p>
            <Button asChild size="lg" className="mt-6 w-full">
              <Link href={`/checkout/bundle/${bundle.slug}`}>Buy Bundle</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
