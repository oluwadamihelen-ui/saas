import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { QuoteBuilderForm } from "./quote-builder-form";
import { markUnderReviewAdmin, declineRequestAdmin } from "../../actions";

export default async function AdminCustomizationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.QUOTES_MANAGE);
  const { id } = await params;

  const request = await prisma.customizationRequest.findUnique({
    where: { id },
    include: { customer: true, application: true, quote: true },
  });
  if (!request) notFound();

  const canQuote = request.status === "SUBMITTED" || request.status === "REVIEWING";
  const markReviewing = markUnderReviewAdmin.bind(null, request.id);
  const decline = declineRequestAdmin.bind(null, request.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{request.customer.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {request.customer.email} · Submitted {formatDate(request.createdAt)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
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

            {request.status === "SUBMITTED" && (
              <div className="flex gap-2 border-t border-border pt-4">
                <form action={markReviewing}>
                  <Button size="sm" type="submit">
                    Start Review
                  </Button>
                </form>
                <form action={decline}>
                  <Button size="sm" variant="destructive" type="submit">
                    Decline
                  </Button>
                </form>
              </div>
            )}
            {request.status === "REVIEWING" && (
              <div className="border-t border-border pt-4">
                <form action={decline}>
                  <Button size="sm" variant="destructive" type="submit">
                    Decline
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {request.quote ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">Quote already sent</p>
                <a href={`/admin/quotes/${request.quote.id}`} className="text-sm text-accent hover:underline">
                  View quote {request.quote.quoteNumber}
                </a>
              </div>
            ) : canQuote ? (
              <>
                <p className="mb-4 text-sm font-semibold text-foreground">Build a quote</p>
                <QuoteBuilderForm requestId={request.id} />
              </>
            ) : (
              <p className="text-sm text-muted">This request was declined.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
