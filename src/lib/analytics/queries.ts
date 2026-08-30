import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * All analytics reads are scoped by businessId, taken exclusively from a
 * caller that has already resolved tenant membership (API route or AI tool
 * layer) — nothing here accepts a businessId from an untrusted source.
 */

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

const PAID_STATUSES = ["PAID", "PROCESSING", "READY", "SHIPPED", "DELIVERED"] as const;

export async function getSalesSummary(businessId: string, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: {
      businessId,
      createdAt: { gte: from, lt: to },
      paymentStatus: "PAID",
    },
    select: { id: true, total: true, customerId: true, createdAt: true },
  });

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
  const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;

  return { revenue, orderCount, avgOrderValue, uniqueCustomers, from, to };
}

export async function getTodaySales(businessId: string) {
  return getSalesSummary(businessId, startOfDay(), new Date());
}

export async function getDashboardMetrics(businessId: string) {
  const today = await getTodaySales(businessId);
  const totalCustomers = await prisma.customer.count({ where: { businessId } });
  return {
    todaysSales: today.revenue,
    todaysOrders: today.orderCount,
    totalCustomers,
    avgOrderValue: today.avgOrderValue,
  };
}

export async function getTopProducts(businessId: string, from: Date, to: Date, limit = 5) {
  const items = await prisma.orderItem.groupBy({
    by: ["productId", "productName"],
    where: {
      order: { businessId, createdAt: { gte: from, lt: to }, paymentStatus: "PAID" },
    },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { total: "desc" } },
    take: limit,
  });

  return items.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    unitsSold: i._sum.quantity ?? 0,
    revenue: Number(i._sum.total ?? 0),
  }));
}

export async function getSalesByCategory(businessId: string, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<Array<{ category: string | null; revenue: Prisma.Decimal }>>`
    SELECT COALESCE(pc.name, 'Uncategorized') as category, SUM(oi.total) as revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Product" p ON p.id = oi."productId"
    LEFT JOIN "ProductCategory" pc ON pc.id = p."categoryId"
    WHERE o."businessId" = ${businessId}
      AND o."paymentStatus" = 'PAID'
      AND o."createdAt" >= ${from}
      AND o."createdAt" < ${to}
    GROUP BY pc.name
    ORDER BY revenue DESC
  `;
  return rows.map((r) => ({ category: r.category ?? "Uncategorized", revenue: Number(r.revenue) }));
}

export async function getLowStockProducts(businessId: string) {
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
  });
  return products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
}

export async function getInventoryOverview(businessId: string) {
  const products = await prisma.product.findMany({ where: { businessId } });
  const totalProducts = products.length;
  const totalUnits = products.reduce((s, p) => s + p.stockQuantity, 0);
  const inventoryValue = products.reduce((s, p) => s + p.stockQuantity * Number(p.costPrice ?? p.price), 0);
  const lowStock = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold);
  const outOfStock = products.filter((p) => p.stockQuantity <= 0);
  return { totalProducts, totalUnits, inventoryValue, lowStock, outOfStock };
}

export async function getCustomerSegmentCounts(businessId: string) {
  const customers = await prisma.customer.findMany({
    where: { businessId },
    include: { orders: { where: { paymentStatus: "PAID" }, select: { total: true, createdAt: true } } },
  });

  const now = new Date();
  let vip = 0;
  let returning = 0;
  let inactive = 0;
  let brandNew = 0;

  for (const c of customers) {
    const totalSpent = c.orders.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = c.orders.length;
    const lastOrder = c.orders.map((o) => o.createdAt).sort((a, b) => b.getTime() - a.getTime())[0];
    const daysSinceLast = lastOrder ? (now.getTime() - lastOrder.getTime()) / 86_400_000 : Infinity;

    if (totalSpent >= 200_000) vip += 1;
    else if (orderCount === 0) brandNew += 1;
    else if (daysSinceLast > 60) inactive += 1;
    else if (orderCount > 1) returning += 1;
    else brandNew += 1;
  }

  return { vip, returning, inactive, new: brandNew, total: customers.length };
}

export async function getDailyRevenueSeries(businessId: string, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<Array<{ day: Date; revenue: Prisma.Decimal; orders: bigint }>>`
    SELECT date_trunc('day', "createdAt") as day, SUM(total) as revenue, COUNT(*) as orders
    FROM "Order"
    WHERE "businessId" = ${businessId}
      AND "paymentStatus" = 'PAID'
      AND "createdAt" >= ${from}
      AND "createdAt" < ${to}
    GROUP BY day
    ORDER BY day ASC
  `;
  return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), revenue: Number(r.revenue), orders: Number(r.orders) }));
}

export async function getRepeatPurchaseRate(businessId: string, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { businessId, createdAt: { gte: from, lt: to }, paymentStatus: "PAID" },
    select: { customerId: true },
  });
  const counts = new Map<string, number>();
  for (const o of orders) counts.set(o.customerId, (counts.get(o.customerId) ?? 0) + 1);
  const repeatCustomers = [...counts.values()].filter((c) => c > 1).length;
  const totalCustomers = counts.size;
  return totalCustomers > 0 ? repeatCustomers / totalCustomers : 0;
}

export async function getCustomersBySegmentType(
  businessId: string,
  type: "NEW" | "RETURNING" | "VIP" | "HIGH_VALUE" | "INACTIVE"
) {
  const customers = await prisma.customer.findMany({
    where: { businessId },
    include: { orders: { where: { paymentStatus: "PAID" }, select: { total: true, createdAt: true } } },
  });

  const now = new Date();
  return customers.filter((c) => {
    const totalSpent = c.orders.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = c.orders.length;
    const lastOrder = c.orders.map((o) => o.createdAt).sort((a, b) => b.getTime() - a.getTime())[0];
    const daysSinceLast = lastOrder ? (now.getTime() - lastOrder.getTime()) / 86_400_000 : Infinity;

    switch (type) {
      case "VIP":
      case "HIGH_VALUE":
        return totalSpent >= 200_000;
      case "NEW":
        return orderCount === 0;
      case "INACTIVE":
        return orderCount > 0 && daysSinceLast > 60;
      case "RETURNING":
        return orderCount > 1 && daysSinceLast <= 60;
      default:
        return false;
    }
  });
}

export async function getCustomerLifetimeValue(businessId: string, customerId: string) {
  const orders = await prisma.order.findMany({
    where: { businessId, customerId, paymentStatus: "PAID" },
    orderBy: { createdAt: "asc" },
  });
  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  return {
    totalOrders: orders.length,
    totalSpent,
    avgOrderValue: orders.length ? totalSpent / orders.length : 0,
    firstOrderAt: orders[0]?.createdAt ?? null,
    lastOrderAt: orders[orders.length - 1]?.createdAt ?? null,
  };
}
