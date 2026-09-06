import type { Metadata } from "next";
import { Server } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Hosting" };

export default async function HostingPage() {
  const user = await requireUser();
  const accounts = await prisma.hostingAccount.findMany({
    where: { customerId: user.id },
    include: { hostingPlan: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Hosting</h1>

      {accounts.length === 0 ? (
        <EmptyState icon={<Server className="h-8 w-8" />} title="No hosting accounts yet" description="Choose 'Use hosting from us' during checkout to provision one." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const usage = account.usage as { storageUsedGB?: number; bandwidthUsedGB?: number } | null;
            return (
              <Card key={account.id}>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{account.hostingPlan.name}</p>
                      <p className="mt-1 text-xs text-muted">{account.primaryDomain ?? "No domain assigned"}</p>
                    </div>
                    <StatusBadge status={account.status} />
                  </div>
                  {usage && (
                    <div className="mt-4 space-y-1 text-xs text-muted">
                      <p>
                        Storage: {usage.storageUsedGB ?? 0}GB / {account.hostingPlan.storageGB}GB
                      </p>
                      <p>
                        Bandwidth: {usage.bandwidthUsedGB ?? 0}GB / {account.hostingPlan.bandwidthGB}GB
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
