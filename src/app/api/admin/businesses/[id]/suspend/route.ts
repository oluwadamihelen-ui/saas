import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";

const schema = z.object({ isSuspended: z.boolean() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const { isSuspended } = schema.parse(await req.json());

    const business = await prisma.business.update({ where: { id }, data: { isSuspended } });

    await prisma.auditLog.create({
      data: {
        businessId: id,
        userId: session.user.id,
        action: isSuspended ? "BUSINESS_SUSPENDED" : "BUSINESS_UNSUSPENDED",
        entityType: "Business",
        entityId: id,
      },
    });

    return NextResponse.json({ business });
  } catch (err) {
    return apiError(err);
  }
}
