import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";
import { getDomainProvider } from "@/lib/providers/registry";
import { getDomainOrderQuote } from "@/lib/services/domain-orders";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { RegisterDomainForm } from "./register-form";

export const metadata: Metadata = { title: "Register a Domain" };

export default async function RegisterDomainPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { domain: domainName } = await searchParams;

  if (!domainName) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={<Globe className="h-8 w-8" />}
          title="No domain selected"
          description="Search for a domain first, then come back here to register it."
        />
        <div className="mt-4 text-center">
          <Button asChild>
            <Link href="/domains">Search domains</Link>
          </Button>
        </div>
      </div>
    );
  }

  const domainProvider = await getDomainProvider();
  const available = await domainProvider.checkAvailability(domainName);

  if (!available) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState icon={<Globe className="h-8 w-8" />} title={`${domainName} is not available`} description="Try a different domain name or extension." />
        <div className="mt-4 text-center">
          <Button asChild>
            <Link href="/domains">Search domains</Link>
          </Button>
        </div>
      </div>
    );
  }

  const quote = await getDomainOrderQuote(domainName, 1, "REGISTER");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Register {domainName}</h1>
        <p className="mt-1 text-sm text-muted">This domain is available. Choose a registration length to continue.</p>
      </div>
      <Card>
        <CardContent>
          <RegisterDomainForm domainName={domainName} registrationPricePerYear={quote.price} currency={quote.currency} />
        </CardContent>
      </Card>
    </div>
  );
}
