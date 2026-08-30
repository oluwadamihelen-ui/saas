import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PaystackSettingsForm } from "@/components/dashboard/payments/paystack-settings-form";

export default async function PaymentsPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const [settings, payments] = await Promise.all([
    prisma.paymentSettings.findUnique({ where: { businessId: business.id } }),
    prisma.payment.findMany({
      where: { businessId: business.id },
      include: { order: { select: { orderNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accept payments with Paystack.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Paystack</h2>
            <Badge variant={settings?.isConnected ? "success" : "outline"}>
              {settings?.isConnected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <PaystackSettingsForm
            businessId={business.id}
            initialPublicKey={settings?.paystackPublicKey ?? ""}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Transactions</h2>
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No transactions yet." description="Payments will show up here as customers check out." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.providerReference}</TableCell>
                  <TableCell>{p.order?.orderNumber ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(p.amount.toString(), p.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "PAID" ? "success" : p.status === "FAILED" ? "destructive" : "outline"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
