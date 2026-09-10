import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getInvoice, invoiceBalanceMinor } from "@/lib/services/invoices";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { RecordPaymentForm } from "./payment-form";
import { PendingPaymentButtons } from "./pending-payment-buttons";

const STATUS_VARIANT = { ISSUED: "warning", PARTIALLY_PAID: "accent", PAID: "success", CANCELLED: "neutral" } as const;
const PAYMENT_STATUS_VARIANT = { PENDING: "warning", CONFIRMED: "success", FAILED: "danger" } as const;

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.FINANCE_VIEW);
  const perms = await getUserPermissions(user.id);
  const canRecordPayment = perms.has(PERMISSIONS.PAYMENTS_RECORD);

  const [invoice, school] = await Promise.all([
    getInvoice(user.schoolId, id),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);
  if (!invoice) notFound();

  const balance = invoiceBalanceMinor(invoice);
  const payUrl = `${process.env.APP_URL ?? "http://localhost:3001"}/pay/${invoice.payToken}`;

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted">
            {invoice.student.firstName} {invoice.student.lastName} ·{" "}
            {invoice.student.classArm ? `${invoice.student.classArm.classGroup.name} ${invoice.student.classArm.name}` : "—"} ·{" "}
            {invoice.term.name}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[invoice.status]}>{invoice.status.replace("_", " ")}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Description</TableHead><TableHead>Amount</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{formatMoney(item.amountMinor, school.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="space-y-1 border-t border-border p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatMoney(invoice.subtotalMinor, school.currency)}</span></div>
            {invoice.discountMinor > 0 && (
              <div className="flex justify-between"><span className="text-muted">Discount{invoice.discountReason ? ` (${invoice.discountReason})` : ""}</span><span>-{formatMoney(invoice.discountMinor, school.currency)}</span></div>
            )}
            <div className="flex justify-between font-medium text-foreground"><span>Total</span><span>{formatMoney(invoice.totalMinor, school.currency)}</span></div>
            <div className="flex justify-between font-medium text-foreground"><span>Balance due</span><span>{formatMoney(balance, school.currency)}</span></div>
            <div className="flex justify-between text-muted"><span>Due date</span><span>{formatDate(invoice.dueDate)}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canRecordPayment && balance > 0 && <RecordPaymentForm invoiceId={invoice.id} />}
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{formatMoney(p.amountMinor, school.currency)}</p>
                    <p className="text-xs text-muted">{p.method.replace("_", " ")} · {formatDate(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={PAYMENT_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    {p.status === "CONFIRMED" && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={`/api/receipts/${p.id}/pdf`} target="_blank" rel="noreferrer">Receipt</a>
                      </Button>
                    )}
                    {p.status === "PENDING" && canRecordPayment && <PendingPaymentButtons invoiceId={invoice.id} paymentId={p.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {balance > 0 && (
        <Card>
          <CardHeader><CardTitle>Share with a parent</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Anyone with this link can view the invoice and pay online or by bank transfer — no account needed:
            </p>
            <code className="mt-2 block break-all rounded-md bg-muted-surface p-3 text-xs">{payUrl}</code>
          </CardContent>
        </Card>
      )}

      <Link href="/dashboard/finance/invoices" className="text-sm text-accent">← Back to invoices</Link>
    </div>
  );
}
