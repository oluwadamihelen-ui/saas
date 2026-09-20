import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { listWithdrawalsForPlatform } from "@/lib/services/partner-withdrawals";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { MarkUnderReviewButton, ApproveWithdrawalButton, RejectWithdrawalForm, MarkPaidForm } from "./actions-ui";

export const metadata: Metadata = { title: "Partner withdrawals" };

const STATUS_VARIANT = {
  REQUESTED: "warning",
  UNDER_REVIEW: "accent",
  APPROVED: "secondary",
  REJECTED: "danger",
  PAID: "success",
  CANCELLED: "neutral",
} as const;

export default async function PlatformPartnerWithdrawalsPage() {
  await requireSuperAdmin();
  const withdrawals = await listWithdrawalsForPlatform();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/platform/partners">&larr; Partners</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner withdrawals</h1>
        <p className="text-sm text-muted">Manual payout only — pay the Partner outside this app, then record the reference here.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          {withdrawals.length === 0 ? (
            <EmptyState title="No withdrawal requests yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={`/platform/partners/${w.partnerId}`} className="font-medium text-foreground hover:text-accent">
                        {w.partner.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{formatDate(w.requestedAt)}</TableCell>
                    <TableCell>{formatMoney(w.amountMinor, w.currency)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[w.status]}>{w.status}</Badge></TableCell>
                    <TableCell className="text-muted">{w.payoutReference ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {w.status === "REQUESTED" && <MarkUnderReviewButton withdrawalId={w.id} />}
                        {(w.status === "REQUESTED" || w.status === "UNDER_REVIEW") && <ApproveWithdrawalButton withdrawalId={w.id} />}
                        {(w.status === "REQUESTED" || w.status === "UNDER_REVIEW") && <RejectWithdrawalForm withdrawalId={w.id} />}
                        {w.status === "APPROVED" && <MarkPaidForm withdrawalId={w.id} />}
                      </div>
                    </TableCell>
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
