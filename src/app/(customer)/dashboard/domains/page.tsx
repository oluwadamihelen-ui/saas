import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Domains" };

export default async function DomainsPage() {
  const user = await requireUser();
  const domains = await prisma.domain.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
        <Button asChild size="sm">
          <Link href="/domains">Register Domain</Link>
        </Button>
      </div>

      {domains.length === 0 ? (
        <EmptyState icon={<Globe className="h-8 w-8" />} title="No domains yet" description="Register a domain from the marketplace or during checkout." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {domains.map((domain) => (
            <Card key={domain.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{domain.name}</p>
                    <p className="mt-1 text-xs text-muted">Registrar: {domain.registrarProvider}</p>
                  </div>
                  <StatusBadge status={domain.status} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>Expires {domain.expiresAt ? formatDate(domain.expiresAt) : "—"}</span>
                  <span>{domain.autoRenew ? "Auto-renew on" : "Auto-renew off"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
