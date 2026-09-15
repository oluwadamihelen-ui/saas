import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { getBuyerForPlatform } from "@/lib/services/buyer-onboarding";
import { listPartnersForPlatform } from "@/lib/services/partner-onboarding";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  SuspendBuyerForm,
  ReactivateBuyerButton,
  ResetBuyerPasswordButton,
  AttributeBuyerReferralForm,
  OverrideBuyerReferralForm,
  CreateBuyerAgreementForm,
  ApproveBuyerAgreementButton,
  CancelBuyerAgreementForm,
  CompleteBuyerAgreementButton,
  PostProgressUpdateForm,
  CreateBuyerInvoiceForm,
  BuyerInvoiceActions,
} from "./forms";

const BUYER_STATUS_VARIANT = { ACTIVE: "success", SUSPENDED: "danger" } as const;
const AGREEMENT_STATUS_VARIANT = { PENDING: "warning", ACTIVE: "success", COMPLETED: "neutral", CANCELLED: "danger" } as const;
const INVOICE_STATUS_VARIANT = { PENDING: "warning", PAID: "success", OVERDUE: "danger", VOID: "neutral" } as const;
const STAGE_LABEL: Record<string, string> = {
  ORDER_CONFIRMED: "Order confirmed",
  IN_DEVELOPMENT: "In development",
  INSTALLATION: "Installation",
  DELIVERED: "Delivered",
};

export default async function PlatformBuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const [buyer, partners] = await Promise.all([getBuyerForPlatform(id), listPartnersForPlatform()]);
  if (!buyer) notFound();

  const activePartners = partners.filter((p) => p.status === "ACTIVE");
  const activeAgreement = buyer.agreements.find((a) => a.status === "ACTIVE") ?? null;
  const hasPendingAgreement = buyer.agreements.some((a) => a.status === "PENDING");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/platform/buyers">&larr; Buyers</Link></Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          {buyer.displayName} <Badge variant={BUYER_STATUS_VARIANT[buyer.status]}>{buyer.status}</Badge>
        </h1>
        <p className="text-sm text-muted">
          {buyer.user.email} · created {formatDate(buyer.createdAt)}
          {buyer.sourceInquiry && ` · from inquiry: ${buyer.sourceInquiry.schoolOrGroupName}`}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Login credentials</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Login email: <span className="font-mono text-foreground">{buyer.user.email}</span>. There is no email provider in this
            app, so no invite was ever sent automatically — generate a password below and share both with the buyer yourself.
          </p>
          <ResetBuyerPasswordButton buyerId={buyer.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {buyer.status === "ACTIVE" && <SuspendBuyerForm buyerId={buyer.id} />}
          {buyer.status === "SUSPENDED" && (
            <>
              {buyer.suspensionReason && <p className="text-sm text-muted">Reason: {buyer.suspensionReason}</p>}
              <ReactivateBuyerButton buyerId={buyer.id} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Partner attribution</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {buyer.referral ? (
            <>
              <p className="text-sm text-foreground">
                Attributed to <span className="font-medium">{buyer.referral.partner.displayName}</span>{" "}
                <span className="text-muted">({buyer.referral.source}, {formatDate(buyer.referral.attributedAt)})</span>
              </p>
              {buyer.referral.overriddenAt && (
                <p className="text-xs text-muted">
                  Overridden {formatDate(buyer.referral.overriddenAt)}: {buyer.referral.overrideReason}
                </p>
              )}
              <OverrideBuyerReferralForm buyerId={buyer.id} partners={activePartners} />
            </>
          ) : (
            <>
              <EmptyState title="No Partner attribution" description="This Buyer was not referred by a Partner, or the referral link expired before the inquiry was submitted." />
              {activePartners.length > 0 && <AttributeBuyerReferralForm buyerId={buyer.id} partners={activePartners} />}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agreements</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {buyer.agreements.length === 0 ? (
            <EmptyState title="No agreements yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyer.agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant={AGREEMENT_STATUS_VARIANT[a.status]}>{a.status}</Badge></TableCell>
                    <TableCell className="text-muted">{a.partner?.displayName ?? "—"}</TableCell>
                    <TableCell className="text-muted">{a.agreementValueMinor ? formatMoney(a.agreementValueMinor, a.currency) : "—"}</TableCell>
                    <TableCell className="text-muted">{a.status === "ACTIVE" || a.status === "COMPLETED" ? STAGE_LABEL[a.progressStage] : "—"}</TableCell>
                    <TableCell className="text-muted">{formatDate(a.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {a.status === "PENDING" && (
                          <>
                            <ApproveBuyerAgreementButton agreementId={a.id} buyerId={buyer.id} />
                            <CancelBuyerAgreementForm agreementId={a.id} buyerId={buyer.id} />
                          </>
                        )}
                        {a.status === "ACTIVE" && <CompleteBuyerAgreementButton agreementId={a.id} buyerId={buyer.id} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!hasPendingAgreement && !activeAgreement && <CreateBuyerAgreementForm buyerId={buyer.id} partners={activePartners} />}
        </CardContent>
      </Card>

      {activeAgreement && (
        <Card>
          <CardHeader><CardTitle>Build &amp; installation progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {activeAgreement.progressUpdates.length === 0 ? (
              <EmptyState title="No progress updates yet" />
            ) : (
              <div className="space-y-2">
                {activeAgreement.progressUpdates.map((update) => (
                  <div key={update.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{STAGE_LABEL[update.stage]}</span>
                      <span className="text-xs text-muted">{formatDateTime(update.postedAt)}</span>
                    </div>
                    {update.note && <p className="mt-1 text-muted">{update.note}</p>}
                  </div>
                ))}
              </div>
            )}
            <PostProgressUpdateForm agreementId={activeAgreement.id} buyerId={buyer.id} currentStage={activeAgreement.progressStage} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {buyer.invoices.length === 0 ? (
            <EmptyState title="No invoices yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyer.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-muted">{inv.description ?? "—"}</TableCell>
                    <TableCell>{formatMoney(inv.amountMinor, inv.currency)}</TableCell>
                    <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell><Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right"><BuyerInvoiceActions invoiceId={inv.id} buyerId={buyer.id} status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {activeAgreement && <CreateBuyerInvoiceForm agreementId={activeAgreement.id} buyerId={buyer.id} />}
        </CardContent>
      </Card>
    </div>
  );
}
