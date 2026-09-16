import type { Metadata } from "next";
import { requirePartner } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { getPartnerBalance } from "@/lib/services/partner-withdrawals";
import { getPartnerCommissionConfig } from "@/lib/services/partner-commissions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { RequestWithdrawalButton, CancelWithdrawalButton } from "./widgets";

export const metadata: Metadata = { title: "Partner Dashboard" };

const PARTNER_STATUS_VARIANT = { PENDING: "warning", ACTIVE: "success", SUSPENDED: "danger", REJECTED: "danger" } as const;
const COMMISSION_STATUS_VARIANT = {
  PENDING: "warning",
  AVAILABLE: "success",
  RESERVED: "accent",
  PAID: "neutral",
  REVERSED: "danger",
  CANCELLED: "neutral",
} as const;
const WITHDRAWAL_STATUS_VARIANT = {
  REQUESTED: "warning",
  UNDER_REVIEW: "accent",
  APPROVED: "secondary",
  REJECTED: "danger",
  PAID: "success",
  CANCELLED: "neutral",
} as const;

export default async function PartnerDashboardPage() {
  const sessionUser = await requirePartner();
  const partner = await prisma.partner.findUniqueOrThrow({ where: { userId: sessionUser.id } });

  if (partner.status !== "ACTIVE") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Partner application</CardTitle>
          <CardDescription>
            {partner.status === "PENDING" && "Your application is under review. We'll let you know once it's approved."}
            {partner.status === "SUSPENDED" && "Your Partner account is currently suspended."}
            {partner.status === "REJECTED" && "Your application was not approved."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={PARTNER_STATUS_VARIANT[partner.status]}>{partner.status}</Badge>
          {partner.status === "REJECTED" && partner.rejectionReason && (
            <p className="mt-3 text-sm text-muted">Reason: {partner.rejectionReason}</p>
          )}
          {partner.status === "SUSPENDED" && partner.suspensionReason && (
            <p className="mt-3 text-sm text-muted">Reason: {partner.suspensionReason}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const [balance, config, referrals, commissions, withdrawals] = await Promise.all([
    getPartnerBalance(partner.id),
    getPartnerCommissionConfig(),
    prisma.partnerReferral.findMany({ where: { partnerId: partner.id }, include: { school: true, buyer: true }, orderBy: { attributedAt: "desc" } }),
    prisma.partnerCommission.findMany({ where: { partnerId: partner.id }, include: { school: true, buyer: true }, orderBy: { earnedAt: "desc" }, take: 20 }),
    prisma.partnerWithdrawal.findMany({ where: { partnerId: partner.id }, orderBy: { requestedAt: "desc" } }),
  ]);

  const canWithdraw = balance.availableMinor >= config.minimumWithdrawalMinor;
  const hasOpenWithdrawal = withdrawals.some((w) => w.status === "REQUESTED" || w.status === "UNDER_REVIEW");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner Dashboard</h1>
        <p className="text-sm text-muted">Welcome back, {partner.displayName}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted">Available balance</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatMoney(balance.availableMinor, "NGN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted">Pending (in 7-day hold)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatMoney(balance.pendingMinor, "NGN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted">Lifetime earned</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatMoney(balance.lifetimeEarnedMinor, "NGN")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your referral link</CardTitle>
          <CardDescription>Share this link — any school that signs up through it is attributed to you.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <code className="rounded bg-muted-surface px-3 py-1.5 text-sm">/r/{partner.partnerCode}</code>
          <CopyLinkButton path={`/r/${partner.partnerCode}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawals</CardTitle>
          <CardDescription>Manual payout — a Super Admin pays you and records the reference here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {canWithdraw
                ? "Your available balance is ready to withdraw."
                : `You need at least ${formatMoney(config.minimumWithdrawalMinor, "NGN")} available to request a withdrawal.`}
            </p>
            <RequestWithdrawalButton disabled={!canWithdraw || hasOpenWithdrawal} />
          </div>
          {withdrawals.length === 0 ? (
            <EmptyState title="No withdrawals yet" />
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {withdrawals.map((w) => (
                  <div key={w.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{formatMoney(w.amountMinor, w.currency)}</p>
                      <Badge variant={WITHDRAWAL_STATUS_VARIANT[w.status]}>{w.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">Requested {formatDate(w.requestedAt)}</p>
                    {w.payoutReference && <p className="mt-1 text-xs text-muted">Ref: {w.payoutReference}</p>}
                    {(w.status === "REQUESTED" || w.status === "UNDER_REVIEW") && (
                      <div className="mt-2">
                        <CancelWithdrawalButton withdrawalId={w.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{formatDate(w.requestedAt)}</TableCell>
                        <TableCell>{formatMoney(w.amountMinor, w.currency)}</TableCell>
                        <TableCell><Badge variant={WITHDRAWAL_STATUS_VARIANT[w.status]}>{w.status}</Badge></TableCell>
                        <TableCell>{w.payoutReference ?? "—"}</TableCell>
                        <TableCell>
                          {(w.status === "REQUESTED" || w.status === "UNDER_REVIEW") && <CancelWithdrawalButton withdrawalId={w.id} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Referrals</CardTitle></CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <EmptyState title="No referrals yet" description="Share your referral link to start earning commissions." />
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {referrals.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{r.school?.name ?? r.buyer?.displayName}</p>
                      <Badge variant={r.school ? "secondary" : "accent"}>{r.school ? "School" : "Buyer"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{r.source} · attributed {formatDate(r.attributedAt)}</p>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Attributed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><Badge variant={r.school ? "secondary" : "accent"}>{r.school ? "School" : "Buyer"}</Badge></TableCell>
                        <TableCell>{r.school?.name ?? r.buyer?.displayName}</TableCell>
                        <TableCell>{r.source}</TableCell>
                        <TableCell>{formatDate(r.attributedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent commissions</CardTitle></CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <EmptyState title="No commissions yet" />
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {commissions.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{c.school?.name ?? c.buyer?.displayName}</p>
                      <Badge variant={c.school ? "secondary" : "accent"}>{c.school ? "School" : "Buyer"}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{formatMoney(c.commissionAmountMinor, c.currency)}</p>
                      <Badge variant={COMMISSION_STATUS_VARIANT[c.status]}>{c.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {c.commercialMode} · earned {formatDate(c.earnedAt)} · available {formatDate(c.availableAt)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Earned</TableHead>
                      <TableHead>Available from</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell><Badge variant={c.school ? "secondary" : "accent"}>{c.school ? "School" : "Buyer"}</Badge></TableCell>
                        <TableCell>{c.school?.name ?? c.buyer?.displayName}</TableCell>
                        <TableCell>{c.commercialMode}</TableCell>
                        <TableCell>{formatMoney(c.commissionAmountMinor, c.currency)}</TableCell>
                        <TableCell>{formatDate(c.earnedAt)}</TableCell>
                        <TableCell>{formatDate(c.availableAt)}</TableCell>
                        <TableCell><Badge variant={COMMISSION_STATUS_VARIANT[c.status]}>{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
