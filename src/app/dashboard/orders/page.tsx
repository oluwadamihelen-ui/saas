import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { OrdersClient } from "@/components/dashboard/orders/orders-client";

export default async function OrdersPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;

  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { businessId: current.business.id },
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.product.findMany({ where: { businessId: current.business.id, isActive: true } }),
  ]);

  return (
    <OrdersClient
      businessId={current.business.id}
      currency={current.business.currency}
      initialOrders={JSON.parse(JSON.stringify(orders))}
      products={JSON.parse(JSON.stringify(products))}
    />
  );
}
