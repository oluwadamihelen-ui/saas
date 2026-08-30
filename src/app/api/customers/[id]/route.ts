import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, TenantError } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getCustomerLifetimeValue } from "@/lib/analytics/queries";

async function loadOwnedCustomer(id: string, businessId: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer || customer.businessId !== businessId) throw new TenantError("Customer not found", 404);
  return customer;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);
    const customer = await loadOwnedCustomer(id, businessId);

    const [orders, stats, tags] = await Promise.all([
      prisma.order.findMany({ where: { customerId: id }, include: { items: true }, orderBy: { createdAt: "desc" } }),
      getCustomerLifetimeValue(businessId, id),
      prisma.customerTag.findMany({ where: { customerId: id } }),
    ]);

    return NextResponse.json({ customer, orders, stats, tags });
  } catch (err) {
    return apiError(err);
  }
}

const updateSchema = z.object({ businessId: z.string(), notes: z.string().optional(), name: z.string().optional() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data = updateSchema.parse(body);
    await requireBusinessMembership(data.businessId);
    await loadOwnedCustomer(id, data.businessId);

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
    });

    return NextResponse.json({ customer });
  } catch (err) {
    return apiError(err);
  }
}
