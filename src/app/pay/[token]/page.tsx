import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getInvoiceByToken, invoiceBalanceMinor } from "@/lib/services/invoices";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PayOnlineButton, NotifyBankTransferButton } from "./pay-buttons";

const STATUS_VARIANT = { ISSUED: "warning", PARTIALLY_PAID: "accent", PAID: "success", CANCELLED: "neutral" } as const;

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  const balance = invoiceBalanceMinor(invoice);
  const hasBankDetails = invoice.school.bankName && invoice.school.bankAccountNumber;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{invoice.school.name}</h1>
        <p className="text-sm text-muted">Invoice {invoice.invoiceNumber} for {invoice.student.firstName} {invoice.student.lastName}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Amount due</CardTitle>
            <Badge variant={STATUS_VARIANT[invoice.status]}>{invoice.status.replace("_", " ")}</Badge>
          </div>
          <CardDescription>Due {formatDate(invoice.dueDate)}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Description</TableHead><TableHead>Amount</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{formatMoney(item.amountMinor, invoice.school.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="space-y-1 border-t border-border p-4 text-sm">
            <div className="flex justify-between font-medium text-foreground"><span>Total</span><span>{formatMoney(invoice.totalMinor, invoice.school.currency)}</span></div>
            <div className="flex justify-between font-medium text-foreground"><span>Balance due</span><span>{formatMoney(balance, invoice.school.currency)}</span></div>
          </div>
        </CardContent>
      </Card>

      {balance > 0 ? (
        <Card>
          <CardHeader><CardTitle>Pay this invoice</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <PayOnlineButton token={token} />
            {hasBankDetails && (
              <div className="space-y-3 rounded-md border border-dashed border-border p-4">
                <p className="text-sm font-medium text-foreground">Or pay by bank transfer</p>
                <div className="text-sm text-muted">
                  <p>Bank: {invoice.school.bankName}</p>
                  <p>Account name: {invoice.school.bankAccountName}</p>
                  <p>Account number: {invoice.school.bankAccountNumber}</p>
                </div>
                <NotifyBankTransferButton token={token} />
                <p className="text-xs text-muted">The school will confirm your payment once it&apos;s received.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-success">This invoice is fully paid. Thank you!</p>
            {invoice.payments.length > 0 && (
              <a
                className="mt-3 inline-block text-sm text-accent"
                href={`/api/pay/${token}/receipt/${invoice.payments[0].id}`}
                target="_blank"
                rel="noreferrer"
              >
                Download receipt
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
