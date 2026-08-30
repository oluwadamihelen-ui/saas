import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, TenantError } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { ORDER_STATUS_FLOW } from "@/lib/orders";

async function loadOwnedOrder(id: string, businessId: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, customer: true } });
  if (!order || order.businessId !== businessId) throw new TenantError("Order not found", 404);
  return order;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);
    const order = await loadOwnedOrder(id, businessId);
    return NextResponse.json({ order });
  } catch (err) {
    return apiError(err);
  }
}

const updateSchema = z.object({
  businessId: z.string(),
  status: z.enum(ORDER_STATUS_FLOW).optional(),
  merchantNotes: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data = updateSchema.parse(body);
    await requireBusinessMembership(data.businessId);
    await loadOwnedOrder(id, data.businessId);

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.merchantNotes !== undefined ? { merchantNotes: data.merchantNotes } : {}),
      },
      include: { items: true, customer: true },
    });

    return NextResponse.json({ order });
  } catch (err) {
    return apiError(err);
  }
}
