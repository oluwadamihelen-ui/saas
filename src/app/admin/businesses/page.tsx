import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BusinessSuspendToggle } from "@/components/admin/business-suspend-toggle";

export default async function AdminBusinessesPage() {
  await requireAdmin();

  const businesses = await prisma.business.findMany({
    include: { subscription: { include: { plan: true } }, _count: { select: { orders: true, customers: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
        <p className="mt-1 text-sm text-muted-foreground">{businesses.length} businesses on the platform.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Customers</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.name}</TableCell>
              <TableCell>{b.ownerName}</TableCell>
              <TableCell>{b.category}</TableCell>
              <TableCell>{b.subscription?.plan.name ?? "Free"}</TableCell>
              <TableCell>{b._count.orders}</TableCell>
              <TableCell>{b._count.customers}</TableCell>
              <TableCell>
                <Badge variant={b.isSuspended ? "destructive" : "success"}>{b.isSuspended ? "Suspended" : "Active"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <BusinessSuspendToggle businessId={b.id} isSuspended={b.isSuspended} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
