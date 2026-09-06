import type { Metadata } from "next";
import { RefreshCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const subscriptions = await prisma.subscription.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<RefreshCcw className="h-8 w-8" />}
          title="No active subscriptions"
          description="Hosting, maintenance, and support plans you subscribe to appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{sub.type.charAt(0) + sub.type.slice(1).toLowerCase()}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatCurrency(Number(sub.amount), sub.currency)}/{sub.billingCycle === "MONTHLY" ? "mo" : "yr"}
                    </p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="mt-4 space-y-1 text-xs text-muted">
                  {sub.nextBillingDate && <p>Next billing: {formatDate(sub.nextBillingDate)}</p>}
                  {sub.currentPeriodEnd && <p>Current period ends: {formatDate(sub.currentPeriodEnd)}</p>}
                  {sub.cancelledAt && <p>Cancelled: {formatDate(sub.cancelledAt)}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
