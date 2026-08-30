import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { createOrder } from "@/lib/orders";

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") ?? "20"), 100);

    const where = {
      businessId,
      ...(status ? { status: status as never } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, pageSize });
  } catch (err) {
    return apiError(err);
  }
}

const createSchema = z.object({
  businessId: z.string(),
  customerPhone: z.string().min(7),
  customerName: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive() })).min(1),
  deliveryFee: z.coerce.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  customerNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    await requireBusinessMembership(data.businessId);

    const order = await createOrder({ ...data, source: "DASHBOARD" });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
