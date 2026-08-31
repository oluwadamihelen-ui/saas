import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { logWalletSecurityEvent } from "@/lib/wallet-security";

const schema = z.object({ note: z.string().max(500).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const { note } = schema.parse(await req.json().catch(() => ({})));

    const changeRequest = await prisma.payoutAccountChangeRequest.findUnique({ where: { id } });
    if (!changeRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (changeRequest.status !== "PENDING") {
      return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
    }

    const updated = await prisma.payoutAccountChangeRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date(), reviewNote: note },
    });

    await logWalletSecurityEvent(changeRequest.businessId, changeRequest.requestedById, "PAYOUT_CHANGE_REJECTED", {
      reviewNote: note,
    });

    return NextResponse.json({ changeRequest: updated });
  } catch (err) {
    return apiError(err);
  }
}
