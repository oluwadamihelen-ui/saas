import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createCoinPurchaseCheckout, PaymentsNotConfiguredError, CoinPackageUnavailableError } from "@/lib/coinPurchases";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { checkCoinPurchaseRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  coinPackageId: z.string(),
  provider: z.enum(["PAYSTACK", "KORAPAY"]),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    const { allowed, retryAfterSeconds } = await checkCoinPurchaseRateLimit(userId);
    if (!allowed) {
      return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }

    const { coinPackageId, provider } = bodySchema.parse(await request.json());
    const { url } = await createCoinPurchaseCheckout({ userId, coinPackageId, provider });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof PaymentsNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof CoinPackageUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
