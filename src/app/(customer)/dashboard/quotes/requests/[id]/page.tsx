import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export default async function CustomizationRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const request = await prisma.customizationRequest.findFirst({
    where: { id, customerId: user.id },
    include: { application: true, quote: true },
  });
  if (!request) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Custom Work Request</h1>
          <p className="mt-1 text-sm text-muted">Submitted {formatDate(request.createdAt)}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          {request.application && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Related application</p>
              <p className="text-sm text-foreground">{request.application.name}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Description</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{request.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {request.budget && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Budget</p>
                <p className="text-sm text-foreground">{formatCurrency(Number(request.budget))}</p>
              </div>
            )}
            {request.deadline && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Deadline</p>
                <p className="text-sm text-foreground">{formatDate(request.deadline)}</p>
              </div>
            )}
          </div>

          {request.status === "SUBMITTED" || request.status === "REVIEWING" ? (
            <p className="rounded-md bg-muted-surface p-3 text-xs text-muted">
              We&apos;re reviewing this request. You&apos;ll be notified as soon as a quote is ready.
            </p>
          ) : request.status === "DECLINED" ? (
            <p className="rounded-md bg-danger-soft p-3 text-xs text-danger">
              We&apos;re not able to take on this request right now. Contact support if you have questions.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
