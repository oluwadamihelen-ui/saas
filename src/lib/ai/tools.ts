import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { draftMarketingMessage } from "@/lib/marketing";
import {
  getSalesSummary,
  getTodaySales,
  getTopProducts,
  getSalesByCategory,
  getLowStockProducts,
  getInventoryOverview,
  getCustomerSegmentCounts,
  getCustomerLifetimeValue,
  getDashboardMetrics,
  daysAgo,
} from "@/lib/analytics/queries";

/**
 * The Mama AI tool system (spec §21). Every tool here is scoped to a single
 * businessId supplied by the chat route AFTER it has verified tenant
 * membership — a tool never accepts a businessId from the model or the
 * request body, so the AI can never be tricked into reading another
 * merchant's data. Tools that mutate data are marked `destructive` and are
 * never executed automatically — the chat route holds them for explicit
 * user confirmation (spec §22).
 */

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  destructive?: boolean;
  handler: (businessId: string, input: never) => Promise<unknown>;
};

function dateRangeSchema() {
  return z.object({
    from: z.string().optional().describe("ISO date, defaults to 7 days ago"),
    to: z.string().optional().describe("ISO date, defaults to now"),
  });
}

function resolveRange(input: { from?: string; to?: string }) {
  return {
    from: input.from ? new Date(input.from) : daysAgo(7),
    to: input.to ? new Date(input.to) : new Date(),
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "get_today_sales",
    description: "Get today's revenue, order count and average order value for this business.",
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {} },
    handler: async (businessId) => getTodaySales(businessId),
  },
  {
    name: "get_sales_summary",
    description: "Get revenue, order count, average order value and unique customers for a date range.",
    inputSchema: dateRangeSchema(),
    jsonSchema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
    },
    handler: async (businessId, input: never) => {
      const { from, to } = resolveRange(input as { from?: string; to?: string });
      return getSalesSummary(businessId, from, to);
    },
  },
  {
    name: "get_business_metrics",
    description: "Get headline dashboard metrics: today's sales, today's orders, total customers, average order value.",
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {} },
    handler: async (businessId) => getDashboardMetrics(businessId),
  },
  {
    name: "get_orders",
    description: "List recent orders, optionally filtered by status.",
    inputSchema: z.object({
      status: z.string().optional(),
      limit: z.number().int().positive().max(50).optional(),
    }),
    jsonSchema: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "number" } },
    },
    handler: async (businessId, input: never) => {
      const { status, limit } = input as { status?: string; limit?: number };
      return prisma.order.findMany({
        where: { businessId, ...(status ? { status: status as never } : {}) },
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
        take: limit ?? 10,
      });
    },
  },
  {
    name: "get_order",
    description: "Get a single order by its order number.",
    inputSchema: z.object({ orderNumber: z.string() }),
    jsonSchema: { type: "object", properties: { orderNumber: { type: "string" } }, required: ["orderNumber"] },
    handler: async (businessId, input: never) => {
      const { orderNumber } = input as { orderNumber: string };
      return prisma.order.findFirst({
        where: { businessId, orderNumber },
        include: { customer: true, items: true },
      });
    },
  },
  {
    name: "get_customers",
    description: "List customers, optionally filtered by segment (NEW, RETURNING, VIP, INACTIVE).",
    inputSchema: z.object({ segment: z.string().optional() }),
    jsonSchema: { type: "object", properties: { segment: { type: "string" } } },
    handler: async (businessId) => {
      const customers = await prisma.customer.findMany({ where: { businessId }, take: 50, orderBy: { createdAt: "desc" } });
      return Promise.all(
        customers.map(async (c) => ({ ...c, stats: await getCustomerLifetimeValue(businessId, c.id) }))
      );
    },
  },
  {
    name: "get_customer",
    description: "Get a single customer's profile and lifetime value by phone number.",
    inputSchema: z.object({ phone: z.string() }),
    jsonSchema: { type: "object", properties: { phone: { type: "string" } }, required: ["phone"] },
    handler: async (businessId, input: never) => {
      const { phone } = input as { phone: string };
      const customer = await prisma.customer.findUnique({ where: { businessId_phone: { businessId, phone } } });
      if (!customer) return null;
      return { ...customer, stats: await getCustomerLifetimeValue(businessId, customer.id) };
    },
  },
  {
    name: "get_customer_segments",
    description: "Get counts of customers in each segment: VIP, returning, new, inactive.",
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {} },
    handler: async (businessId) => getCustomerSegmentCounts(businessId),
  },
  {
    name: "get_top_products",
    description: "Get the best-selling products by revenue for a date range.",
    inputSchema: dateRangeSchema().extend({ limit: z.number().int().positive().max(20).optional() }),
    jsonSchema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" }, limit: { type: "number" } },
    },
    handler: async (businessId, input: never) => {
      const typed = input as { from?: string; to?: string; limit?: number };
      const { from, to } = resolveRange(typed);
      return getTopProducts(businessId, from, to, typed.limit ?? 5);
    },
  },
  {
    name: "get_product_performance",
    description: "Get sales performance (units sold, revenue) for a specific product by name.",
    inputSchema: z.object({ productName: z.string() }),
    jsonSchema: { type: "object", properties: { productName: { type: "string" } }, required: ["productName"] },
    handler: async (businessId, input: never) => {
      const { productName } = input as { productName: string };
      const product = await prisma.product.findFirst({
        where: { businessId, name: { contains: productName, mode: "insensitive" } },
      });
      if (!product) return null;
      const items = await prisma.orderItem.findMany({
        where: { productId: product.id, order: { paymentStatus: "PAID" } },
      });
      const unitsSold = items.reduce((s, i) => s + i.quantity, 0);
      const revenue = items.reduce((s, i) => s + Number(i.total), 0);
      return { product: product.name, unitsSold, revenue, currentStock: product.stockQuantity };
    },
  },
  {
    name: "get_inventory",
    description: "Get an inventory overview: total products, total units, inventory value, low/out-of-stock counts.",
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {} },
    handler: async (businessId) => {
      const overview = await getInventoryOverview(businessId);
      return {
        totalProducts: overview.totalProducts,
        totalUnits: overview.totalUnits,
        inventoryValue: overview.inventoryValue,
        lowStockCount: overview.lowStock.length,
        outOfStockCount: overview.outOfStock.length,
      };
    },
  },
  {
    name: "get_low_stock_products",
    description: "List products that are at or below their low-stock threshold.",
    inputSchema: z.object({}),
    jsonSchema: { type: "object", properties: {} },
    handler: async (businessId) => getLowStockProducts(businessId),
  },
  {
    name: "get_sales_by_category",
    description: "Get revenue broken down by product category for a date range.",
    inputSchema: dateRangeSchema(),
    jsonSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
    handler: async (businessId, input: never) => {
      const { from, to } = resolveRange(input as { from?: string; to?: string });
      return getSalesByCategory(businessId, from, to);
    },
  },
  {
    name: "generate_marketing_message",
    description:
      "Draft a WhatsApp marketing message for a customer segment (e.g. inactive customers) or a specific occasion. Returns a draft for merchant review — it is never sent automatically.",
    inputSchema: z.object({ segment: z.string().optional(), occasion: z.string().optional() }),
    jsonSchema: {
      type: "object",
      properties: { segment: { type: "string" }, occasion: { type: "string" } },
    },
    handler: async (businessId, input: never) => {
      const { segment, occasion } = input as { segment?: string; occasion?: string };
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      const label = segment ?? "customers";
      const draft = draftMarketingMessage(business?.name ?? "our store", label, occasion);
      return { segment: label, draft };
    },
  },
  {
    name: "create_customer_segment",
    description: "Create a saved custom customer segment. This modifies business data and requires user confirmation.",
    inputSchema: z.object({ name: z.string() }),
    jsonSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    destructive: true,
    handler: async (businessId, input: never) => {
      const { name } = input as { name: string };
      return prisma.customerSegment.create({ data: { businessId, name, type: "CUSTOM" } });
    },
  },
  {
    name: "delete_product",
    description: "Permanently delete a product from the catalog by name. This modifies business data and requires user confirmation.",
    inputSchema: z.object({ productName: z.string() }),
    jsonSchema: { type: "object", properties: { productName: { type: "string" } }, required: ["productName"] },
    destructive: true,
    handler: async (businessId, input: never) => {
      const { productName } = input as { productName: string };
      const product = await prisma.product.findFirst({
        where: { businessId, name: { contains: productName, mode: "insensitive" } },
      });
      if (!product) return { error: "Product not found" };
      await prisma.product.delete({ where: { id: product.id } });
      return { deleted: product.name };
    },
  },
];

export function getTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}
