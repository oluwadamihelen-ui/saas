import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createCoinPurchaseCheckout, StripeNotConfiguredError, CoinPackageUnavailableError } from "@/lib/coinPurchases";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  coinPackageId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { coinPackageId } = bodySchema.parse(await request.json());
    const session = await createCoinPurchaseCheckout({ userId, coinPackageId });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof CoinPackageUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
