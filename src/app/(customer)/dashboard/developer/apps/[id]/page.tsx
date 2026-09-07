import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DeveloperApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("DEVELOPER");
  const { id } = await params;

  const application = await prisma.application.findFirst({
    where: { id, createdById: user.id },
    include: { category: true, pricing: true },
  });
  if (!application) notFound();

  const commissions = await prisma.commission.findMany({
    where: { applicationId: application.id },
    orderBy: { createdAt: "desc" },
    include: { order: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{application.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {application.category.name} · Submitted {formatDate(application.createdAt)}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <Card>
        <CardContent>
          <p className="mb-2 text-sm font-semibold text-foreground">Description</p>
          <p className="text-sm text-muted">{application.fullDescription}</p>
          {application.status === "DRAFT" && (
            <p className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning">
              This application is awaiting review. It won&apos;t be visible in the marketplace or purchasable until an admin approves and publishes it.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-4 text-sm font-semibold text-foreground">Commissions from this app</p>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted">No sales yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {commissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="text-foreground">Order {c.order.orderNumber}</p>
                    <p className="text-xs text-muted">
                      {formatCurrency(Number(c.saleAmount))} sale · {(Number(c.rate) * 100).toFixed(0)}% rate
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{formatCurrency(Number(c.amount))}</p>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
