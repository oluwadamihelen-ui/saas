import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { productSchema } from "@/lib/validation/business";
import { apiError } from "@/lib/api-helpers";
import { assertProductLimit } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") ?? "20"), 100);

    const where = {
      businessId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ products, total, page, pageSize });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, ...rest } = body;
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);
    await assertProductLimit(businessId);

    const data = productSchema.parse(rest);

    let categoryId: string | undefined;
    if (data.categoryName) {
      const category = await prisma.productCategory.upsert({
        where: { businessId_name: { businessId, name: data.categoryName } },
        create: { businessId, name: data.categoryName },
        update: {},
      });
      categoryId = category.id;
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId,
        name: data.name,
        description: data.description ?? undefined,
        sku: data.sku || undefined,
        price: data.price,
        costPrice: data.costPrice ?? undefined,
        stockQuantity: data.stockQuantity,
        lowStockThreshold: data.lowStockThreshold,
        primaryImageUrl: data.primaryImageUrl ?? undefined,
        isActive: data.isActive,
      },
    });

    if (data.stockQuantity > 0) {
      await prisma.inventoryMovement.create({
        data: {
          businessId,
          productId: product.id,
          type: "STOCK_ADDED",
          quantity: data.stockQuantity,
          note: "Initial stock",
        },
      });
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
