import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, rateLimit } from "@/lib/api-helpers";
import { createOrder } from "@/lib/orders";

/**
 * Public storefront checkout — no MAMA account required (spec §6/§26).
 * Protected by rate limiting rather than auth, since shoppers are
 * deliberately anonymous here.
 */
const schema = z.object({
  businessSlug: z.string(),
  customerPhone: z.string().min(7),
  customerName: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.coerce.number().int().positive() })).min(1),
  deliveryAddress: z.string().optional(),
  customerNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`storefront:order:${ip}`, 15, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const data = schema.parse(body);

    const business = await prisma.business.findUnique({ where: { slug: data.businessSlug } });
    if (!business || business.isSuspended) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const order = await createOrder({
      businessId: business.id,
      customerPhone: data.customerPhone,
      customerName: data.customerName,
      items: data.items,
      deliveryAddress: data.deliveryAddress,
      customerNotes: data.customerNotes,
      source: "STOREFRONT",
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
