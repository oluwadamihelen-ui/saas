import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getCustomerLifetimeValue } from "@/lib/analytics/queries";

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] }
          : {}),
      },
      include: { tags: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const withStats = await Promise.all(
      customers.map(async (c) => ({ ...c, stats: await getCustomerLifetimeValue(businessId, c.id) }))
    );

    return NextResponse.json({ customers: withStats });
  } catch (err) {
    return apiError(err);
  }
}
