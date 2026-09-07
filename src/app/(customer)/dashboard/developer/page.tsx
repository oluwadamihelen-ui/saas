import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { listApplicationsForDeveloper, getCommissionSummaryForDeveloper } from "@/lib/services/developer-applications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Developer" };

export default async function DeveloperOverviewPage() {
  const user = await requireRole("DEVELOPER");

  const [applications, { pending, paid }] = await Promise.all([listApplicationsForDeveloper(user.id), getCommissionSummaryForDeveloper(user.id)]);

  const published = applications.filter((a) => a.status === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Developer Dashboard</h1>
        <Button asChild size="sm">
          <Link href="/dashboard/developer/apps/new">Submit an App</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold uppercase text-muted">Applications</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{applications.length}</p>
            <p className="mt-1 text-xs text-muted">{published} published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold uppercase text-muted">Pending commissions</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold uppercase text-muted">Paid out</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(paid)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Your applications</p>
            <Link href="/dashboard/developer/apps" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          {applications.length === 0 ? (
            <p className="text-sm text-muted">No applications submitted yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {applications.slice(0, 5).map((app) => (
                <div key={app.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{app.name}</p>
                    <p className="text-xs text-muted">{app.category.name}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
