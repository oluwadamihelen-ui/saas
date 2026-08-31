import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PayoutRequestActions } from "@/components/admin/payout-request-actions";

export default async function AdminPayoutRequestsPage() {
  await requireAdmin();

  const requests = await prisma.payoutAccountChangeRequest.findMany({
    include: {
      business: { select: { name: true, bankAccount: { select: { accountNumber: true, bankName: true } } } },
      requestedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payout account change requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length} pending review. A merchant's saved payout account only ever changes once you approve a
          request here — verify their identity out of band (call the number on file) before approving.
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title="No change requests yet." description="Merchants can't edit a saved payout account directly — requests to change one will show up here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Current account</TableHead>
              <TableHead>Requested account</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.business.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.business.bankAccount ? `${r.business.bankAccount.bankName ?? "Bank"} — ${r.business.bankAccount.accountNumber}` : "—"}
                </TableCell>
                <TableCell>
                  {r.bankName ?? "Bank"} — {r.accountNumber}
                  {r.resolvedAccountName && (
                    <div className="text-xs text-muted-foreground">{r.resolvedAccountName}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.requestedBy.name ?? r.requestedBy.email}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.reason ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "destructive"}
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "PENDING" && <PayoutRequestActions requestId={r.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
