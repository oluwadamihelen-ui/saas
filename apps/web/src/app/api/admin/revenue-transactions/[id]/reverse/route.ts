import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { reverseContentUnlock, RevenueTransactionNotFoundError, AlreadyReversedError } from "@/lib/monetization";
import { requireAdmin } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  reason: z.string().min(1).max(2000),
  revokeAccess: z.boolean().default(false),
});

/** Admin-only: reverses a settled content unlock (refund/chargeback/fraud dispute — spec §28-29). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const body = bodySchema.parse(await request.json());
    await reverseContentUnlock(params.id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof RevenueTransactionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AlreadyReversedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
