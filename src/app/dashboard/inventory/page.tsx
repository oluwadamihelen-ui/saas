import { getCurrentBusiness } from "@/lib/current-business";
import { getInventoryOverview } from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { InventoryClient } from "@/components/dashboard/inventory/inventory-client";

export default async function InventoryPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const overview = await getInventoryOverview(business.id);
  const products = await prisma.product.findMany({
    where: { businessId: business.id },
    orderBy: { stockQuantity: "asc" },
  });
  const movements = await prisma.inventoryMovement.findMany({
    where: { businessId: business.id },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const stats = [
    { label: "Total Products", value: formatNumber(overview.totalProducts) },
    { label: "Total Inventory Units", value: formatNumber(overview.totalUnits) },
    { label: "Inventory Value", value: formatCurrency(overview.inventoryValue, business.currency) },
    { label: "Low Stock", value: formatNumber(overview.lowStock.length) },
    { label: "Out of Stock", value: formatNumber(overview.outOfStock.length) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep stock levels healthy.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {overview.lowStock.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-amber-800">⚠️ Low stock alerts</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {overview.lowStock.map((p) => (
                <li key={p.id}>
                  {p.name} is running low — {p.stockQuantity} left (notify below {p.lowStockThreshold}).
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <InventoryClient
        businessId={business.id}
        products={JSON.parse(JSON.stringify(products))}
        movements={JSON.parse(JSON.stringify(movements))}
      />
    </div>
  );
}
