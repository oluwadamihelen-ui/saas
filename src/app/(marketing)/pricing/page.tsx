import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pricing" };

const ITEMS = [
  { name: "Software License", price: "From $199", note: "One-time, per application" },
  { name: "Installation", price: "From $49", note: "One-time setup on your chosen infrastructure" },
  { name: "Customization", price: "From $199", note: "Scoped and quoted per request" },
  { name: "Hosting", price: "From $10/mo", note: "Managed hosting plans, billed monthly or yearly" },
  { name: "Maintenance", price: "From $29/mo", note: "Updates, monitoring, and security patches" },
  { name: "Domain Registration", price: "From $12.99/yr", note: "Across popular extensions" },
];

export default function PricingPage() {
  return (
    <div className="container-shell py-14">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Simple, transparent pricing</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Every application has its own license price. Add installation, customization, hosting, and a domain as you
          need them — the checkout totals everything for you.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.name} className="rounded-lg border border-border bg-surface p-6">
            <p className="text-sm font-medium text-muted">{item.name}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{item.price}</p>
            <p className="mt-2 text-sm text-muted">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-lg border border-border bg-accent-soft p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">Need something bundled?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Ask about bundles that combine an application, domain, hosting, installation, and support at a fixed price.
        </p>
        <Button asChild className="mt-5">
          <Link href="/contact">Talk to Sales</Link>
        </Button>
      </div>
    </div>
  );
}
