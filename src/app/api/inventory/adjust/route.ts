import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, TenantError } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";

const schema = z.object({
  businessId: z.string(),
  productId: z.string(),
  type: z.enum(["STOCK_ADDED", "STOCK_REMOVED", "ADJUSTMENT", "RETURN"]),
  quantity: z.coerce.number().int().positive(),
  note: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    await requireBusinessMembership(data.businessId);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product || product.businessId !== data.businessId) {
      throw new TenantError("Product not found", 404);
    }

    const delta = data.type === "STOCK_REMOVED" ? -data.quantity : data.quantity;
    const newQuantity = product.stockQuantity + delta;
    if (newQuantity < 0) {
      return NextResponse.json({ error: "Stock cannot go below zero" }, { status: 400 });
    }

    const [, movement] = await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { stockQuantity: newQuantity } }),
      prisma.inventoryMovement.create({
        data: {
          businessId: data.businessId,
          productId: product.id,
          type: data.type,
          quantity: delta,
          note: data.note,
        },
      }),
    ]);

    return NextResponse.json({ movement, newQuantity });
  } catch (err) {
    return apiError(err);
  }
}
