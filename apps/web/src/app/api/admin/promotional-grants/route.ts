import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { grantPromotionalCoins } from "@/lib/promotionalCoins";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  targetUserEmail: z.string().email(),
  coins: z.number().int().positive(),
  expiresInDays: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin();
    const { targetUserEmail, coins, expiresInDays, reason } = bodySchema.parse(await request.json());
    await grantPromotionalCoins({ targetUserEmail, coins, expiresInDays, reason, grantedByAdminId: adminUserId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
