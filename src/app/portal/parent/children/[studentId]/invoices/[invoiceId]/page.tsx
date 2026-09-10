import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireSchoolUser } from "@/lib/auth/require";
import { getChildForGuardian } from "@/lib/services/portal";
import { getInvoice, invoiceBalanceMinor } from "@/lib/services/invoices";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PortalPayOnlineButton, PortalNotifyBankTransferButton } from "./pay-buttons";

const STATUS_VARIANT = { ISSUED: "warning", PARTIALLY_PAID: "accent", PAID: "success", CANCELLED: "neutral" } as const;

/// The in-portal counterpart to the public /pay/[token] page — same
/// content and the same payment actions underneath, but rendered inside
/// the parent portal's own layout so the sidebar/topbar never disappears.
/// The public link still exists (for sharing a payment link outside the
/// portal, e.g. by SMS/WhatsApp to a guardian who isn't the one logged
/// in); this route is what "Pay / view" now opens from inside the portal.
export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ studentId: string; invoiceId: string }>;
}) {
  const { studentId, invoiceId } = await params;
  const user = await requireSchoolUser();

  const [student, invoice] = await Promise.all([
    getChildForGuardian(user.schoolId, user.id, studentId),
    getInvoice(user.schoolId, invoiceId),
  ]);
  if (!student || !invoice || invoice.studentId !== studentId) notFound();

  const school = await prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } });
  const balance = invoiceBalanceMinor(invoice);
  const hasBankDetails = school.bankName && school.bankAccountNumber;
  const confirmedPayments = invoice.payments.filter((p) => p.status === "CONFIRMED");

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <Link href={`/portal/parent/children/${studentId}`} className="text-sm text-muted hover:text-accent">
          &larr; {student.firstName} {student.lastName}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Invoice {invoice.invoiceNumber}</h1>
        <p className="text-sm text-muted">{invoice.term.name}</p>
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
                  <TableCell>{formatMoney(item.amountMinor, school.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="space-y-1 border-t border-border p-4 text-sm">
            <div className="flex justify-between font-medium text-foreground"><span>Total</span><span>{formatMoney(invoice.totalMinor, school.currency)}</span></div>
            <div className="flex justify-between font-medium text-foreground"><span>Balance due</span><span>{formatMoney(balance, school.currency)}</span></div>
          </div>
        </CardContent>
      </Card>

      {balance > 0 ? (
        <Card>
          <CardHeader><CardTitle>Pay this invoice</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <PortalPayOnlineButton studentId={studentId} invoiceId={invoiceId} />
            {hasBankDetails && (
              <div className="space-y-3 rounded-md border border-dashed border-border p-4">
                <p className="text-sm font-medium text-foreground">Or pay by bank transfer</p>
                <div className="text-sm text-muted">
                  <p>Bank: {school.bankName}</p>
                  <p>Account name: {school.bankAccountName}</p>
                  <p>Account number: {school.bankAccountNumber}</p>
                </div>
                <PortalNotifyBankTransferButton studentId={studentId} invoiceId={invoiceId} />
                <p className="text-xs text-muted">The school will confirm your payment once it&apos;s received.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-success">This invoice is fully paid. Thank you!</p>
            {confirmedPayments.length > 0 && (
              <a
                className="mt-3 inline-block text-sm text-accent"
                href={`/api/pay/${invoice.payToken}/receipt/${confirmedPayments[0].id}`}
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
