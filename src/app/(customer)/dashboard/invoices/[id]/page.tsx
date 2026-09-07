import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, customerId: user.id }, include: { items: true } });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 print:max-w-none">
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-foreground">Invoice {invoice.invoiceNumber}</p>
              <p className="mt-1 text-sm text-muted">Issued {formatDate(invoice.issuedAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              <Button asChild size="sm" variant="secondary">
                <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" /> PDF
                </a>
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">BridgeCodes, Inc.</p>
            <p className="text-sm text-muted">billing@bridgecodes.example</p>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {invoice.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted">
                  {item.description} × {item.quantity}
                </span>
                <span className="font-medium">{formatCurrency(Number(item.total), invoice.currency)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Discount</span>
              <span>-{formatCurrency(Number(invoice.discount), invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Tax</span>
              <span>{formatCurrency(Number(invoice.tax), invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCurrency(Number(invoice.total), invoice.currency)}</span>
            </div>
          </div>

          {invoice.paidAt && <p className="text-xs text-success">Paid on {formatDate(invoice.paidAt)}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
