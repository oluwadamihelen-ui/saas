import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { getPartnerForPlatform } from "@/lib/services/partner-onboarding";
import { getPartnerBalance } from "@/lib/services/partner-withdrawals";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ApprovePartnerForm, RejectPartnerForm, SuspendPartnerForm, ReactivatePartnerForm } from "./status-forms";

const PARTNER_STATUS_VARIANT = { PENDING: "warning", ACTIVE: "success", SUSPENDED: "danger", REJECTED: "neutral" } as const;
const AGREEMENT_STATUS_VARIANT = {
  PENDING: "warning",
  ACTIVE: "success",
  COMPLETED: "neutral",
  SUPERSEDED: "neutral",
  CANCELLED: "danger",
} as const;
const WITHDRAWAL_STATUS_VARIANT = {
  REQUESTED: "warning",
  UNDER_REVIEW: "accent",
  APPROVED: "secondary",
  REJECTED: "danger",
  PAID: "success",
  CANCELLED: "neutral",
} as const;

export default async function PlatformPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const partner = await getPartnerForPlatform(id);
  if (!partner) notFound();

  const balance = await getPartnerBalance(partner.id);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/platform/partners">&larr; Partners</Link></Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          {partner.displayName} <Badge variant={PARTNER_STATUS_VARIANT[partner.status]}>{partner.status}</Badge>
        </h1>
        <p className="text-sm text-muted">
          {partner.user.email} · code <span className="font-mono">{partner.partnerCode}</span> · applied {formatDate(partner.appliedAt)}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Application status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {partner.status === "PENDING" && (
            <div className="flex flex-wrap gap-2">
              <ApprovePartnerForm partnerId={partner.id} />
              <RejectPartnerForm partnerId={partner.id} />
            </div>
          )}
          {partner.status === "ACTIVE" && <SuspendPartnerForm partnerId={partner.id} />}
          {partner.status === "SUSPENDED" && (
            <>
              {partner.suspensionReason && <p className="text-sm text-muted">Reason: {partner.suspensionReason}</p>}
              <ReactivatePartnerForm partnerId={partner.id} />
            </>
          )}
          {partner.status === "REJECTED" && partner.rejectionReason && <p className="text-sm text-muted">Reason: {partner.rejectionReason}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted">Available balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-foreground">{formatMoney(balance.availableMinor, "NGN")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted">Pending (7-day hold)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-foreground">{formatMoney(balance.pendingMinor, "NGN")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted">Lifetime earned</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-foreground">{formatMoney(balance.lifetimeEarnedMinor, "NGN")}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
          <CardDescription>{partner._count.commissions} total commission{partner._count.commissions === 1 ? "" : "s"} earned</CardDescription>
        </CardHeader>
        <CardContent>
          {partner.referrals.length === 0 ? (
            <EmptyState title="No referrals yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attributed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.referrals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant={r.school ? "secondary" : "accent"}>{r.school ? "School" : "Buyer"}</Badge></TableCell>
                    <TableCell>
                      {r.school ? (
                        <Link href={`/platform/schools/${r.schoolId}`} className="font-medium text-foreground hover:text-accent">
                          {r.school.name}
                        </Link>
                      ) : (
                        <Link href={`/platform/buyers/${r.buyerId}`} className="font-medium text-foreground hover:text-accent">
                          {r.buyer?.displayName}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-muted">{r.source}</TableCell>
                    <TableCell><Badge variant="neutral">{r.status}</Badge></TableCell>
                    <TableCell className="text-muted">{formatDate(r.attributedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commercial agreements</CardTitle></CardHeader>
        <CardContent>
          {partner.agreements.length === 0 ? (
            <EmptyState title="No commercial agreements yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/platform/schools/${a.schoolId}`} className="font-medium text-foreground hover:text-accent">
                        {a.school.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{a.commercialMode}</TableCell>
                    <TableCell><Badge variant={AGREEMENT_STATUS_VARIANT[a.status]}>{a.status}</Badge></TableCell>
                    <TableCell className="text-muted">{(a.commissionRateBps / 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-muted">{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Buyer agreements</CardTitle></CardHeader>
        <CardContent>
          {partner.buyerAgreements.length === 0 ? (
            <EmptyState title="No Buyer agreements yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.buyerAgreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/platform/buyers/${a.buyerId}`} className="font-medium text-foreground hover:text-accent">
                        {a.buyer.displayName}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant={AGREEMENT_STATUS_VARIANT[a.status]}>{a.status}</Badge></TableCell>
                    <TableCell className="text-muted">{(a.commissionRateBps / 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-muted">{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Withdrawals</CardTitle></CardHeader>
        <CardContent>
          {partner.withdrawals.length === 0 ? (
            <EmptyState title="No withdrawals yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{formatDate(w.requestedAt)}</TableCell>
                    <TableCell>{formatMoney(w.amountMinor, w.currency)}</TableCell>
                    <TableCell><Badge variant={WITHDRAWAL_STATUS_VARIANT[w.status]}>{w.status}</Badge></TableCell>
                    <TableCell className="text-muted">{w.payoutReference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
