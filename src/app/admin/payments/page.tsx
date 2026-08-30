import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const payments = await prisma.payment.findMany({
    include: { business: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const failed = payments.filter((p) => p.status === "FAILED");
  const refunded = payments.filter((p) => p.status === "REFUNDED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {payments.length} transactions · {failed.length} failed · {refunded.length} refunded
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.business.name}</TableCell>
              <TableCell className="font-mono text-xs">{p.providerReference}</TableCell>
              <TableCell>{formatCurrency(p.amount.toString(), p.currency)}</TableCell>
              <TableCell>
                <Badge variant={p.status === "PAID" ? "success" : p.status === "FAILED" ? "destructive" : "outline"}>{p.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
