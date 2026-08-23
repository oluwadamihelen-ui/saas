import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { setProjectMonetization, NotContentOwnerError, PriceOutOfRangeError, InvalidMonetizationConfigError } from "@/lib/monetization";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  mode: z.enum(["FREE", "PAID"]),
  scope: z.enum(["MOVIE", "EPISODE", "SCENE"]).optional(),
  coinPrice: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const body = bodySchema.parse(await request.json());
    await setProjectMonetization(userId, params.id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof NotContentOwnerError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof PriceOutOfRangeError || error instanceof InvalidMonetizationConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
