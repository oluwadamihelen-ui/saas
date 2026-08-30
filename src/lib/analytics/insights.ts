import "server-only";
import {
  getTodaySales,
  getSalesByCategory,
  getCustomerSegmentCounts,
  getLowStockProducts,
  startOfDay,
  daysAgo,
} from "@/lib/analytics/queries";
import { formatCurrency } from "@/lib/utils";

/**
 * Deterministic, data-grounded insights — every sentence here is generated
 * directly from a Prisma aggregate, never from an LLM guess. Mama AI chat
 * (lib/ai) can restate these in a friendlier voice, but the underlying
 * numbers always come from here or from the same tool layer it calls.
 */
export async function generateDashboardInsights(businessId: string, currency = "NGN") {
  const insights: string[] = [];

  const today = await getTodaySales(businessId);
  if (today.orderCount > 0) {
    insights.push(
      `You made ${formatCurrency(today.revenue, currency)} today from ${today.orderCount} order${today.orderCount === 1 ? "" : "s"}.`
    );
  }

  const weekCategories = await getSalesByCategory(businessId, daysAgo(7), new Date());
  const weekTotal = weekCategories.reduce((s, c) => s + c.revenue, 0);
  if (weekTotal > 0) {
    const top = weekCategories[0];
    const pct = Math.round((top.revenue / weekTotal) * 100);
    if (pct >= 25) {
      insights.push(`Your ${top.category} products generated ${pct}% of this week's revenue.`);
    }
  }

  const segments = await getCustomerSegmentCounts(businessId);
  if (segments.inactive > 0) {
    insights.push(
      `${segments.inactive} customer${segments.inactive === 1 ? "" : "s"} who normally purchase regularly haven't ordered in over 60 days.`
    );
  }

  const lowStock = await getLowStockProducts(businessId);
  if (lowStock.length > 0) {
    insights.push(
      `⚠️ ${lowStock[0].name} is running low${lowStock.length > 1 ? ` (and ${lowStock.length - 1} other product${lowStock.length - 1 === 1 ? "" : "s"})` : ""}.`
    );
  }

  if (insights.length === 0) {
    insights.push("Add products and start taking orders — Mama will surface insights here as your sales data comes in.");
  }

  return insights;
}
