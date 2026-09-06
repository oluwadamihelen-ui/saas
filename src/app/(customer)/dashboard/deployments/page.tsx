import Link from "next/link";
import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { listDeploymentsForCustomer } from "@/lib/services/deployments";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Deployments" };

export default async function DeploymentsPage() {
  const user = await requireUser();
  const deployments = await listDeploymentsForCustomer(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>

      {deployments.length === 0 ? (
        <EmptyState icon={<Rocket className="h-8 w-8" />} title="No deployments yet" description="Deployments appear here once you purchase an application." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {deployments.map((d) => (
            <Link key={d.id} href={`/dashboard/deployments/${d.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{d.application.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {d.type.replaceAll("_", " ")} · {formatDate(d.createdAt)}
                      </p>
                      {d.domain && <p className="mt-1 text-xs text-accent">{d.domain.name}</p>}
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
