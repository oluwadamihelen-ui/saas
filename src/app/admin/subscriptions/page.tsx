import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function AdminSubscriptionsPage() {
  await requireAdmin();

  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true, business: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const byPlan = subscriptions.reduce<Record<string, number>>((acc, s) => {
    acc[s.plan.key] = (acc[s.plan.key] ?? 0) + 1;
    return acc;
  }, {});
  const mrr = subscriptions.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + Number(s.plan.priceMonthly), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Free</p><p className="mt-2 text-2xl font-bold">{byPlan.FREE ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Growth</p><p className="mt-2 text-2xl font-bold">{byPlan.GROWTH ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Pro</p><p className="mt-2 text-2xl font-bold">{byPlan.PRO ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">MRR</p><p className="mt-2 text-2xl font-bold">{formatCurrency(mrr)}</p></CardContent></Card>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.business.name}</TableCell>
              <TableCell>{s.plan.name}</TableCell>
              <TableCell><Badge variant={s.status === "ACTIVE" ? "success" : "outline"}>{s.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
