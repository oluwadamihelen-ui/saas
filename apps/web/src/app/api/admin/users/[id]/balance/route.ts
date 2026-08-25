import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { adjustUserBalance } from "@/lib/userAdmin";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  amount: z.number().int(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminUserId = await requireAdmin();
    const { amount, reason } = bodySchema.parse(await request.json());
    const { balanceAfter } = await adjustUserBalance({ targetUserId: params.id, adminUserId, amount, reason });
    return NextResponse.json({ ok: true, balanceAfter });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
