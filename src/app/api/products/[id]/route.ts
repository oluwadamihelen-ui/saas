import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, TenantError } from "@/lib/tenant";
import { productSchema } from "@/lib/validation/business";
import { apiError } from "@/lib/api-helpers";

async function loadOwnedProduct(id: string, businessId: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.businessId !== businessId) {
    throw new TenantError("Product not found", 404);
  }
  return product;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { businessId, ...rest } = body;
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);
    await loadOwnedProduct(id, businessId);

    const data = productSchema.partial().parse(rest);

    let categoryId: string | undefined | null = undefined;
    if (data.categoryName !== undefined) {
      if (data.categoryName) {
        const category = await prisma.productCategory.upsert({
          where: { businessId_name: { businessId, name: data.categoryName } },
          create: { businessId, name: data.categoryName },
          update: {},
        });
        categoryId = category.id;
      } else {
        categoryId = null;
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.sku !== undefined ? { sku: data.sku || null } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
        ...(data.stockQuantity !== undefined ? { stockQuantity: data.stockQuantity } : {}),
        ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: data.lowStockThreshold } : {}),
        ...(data.primaryImageUrl !== undefined ? { primaryImageUrl: data.primaryImageUrl } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
      },
    });

    return NextResponse.json({ product });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);
    await loadOwnedProduct(id, businessId);

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
