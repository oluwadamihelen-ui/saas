import { NextResponse } from "next/server";
import { requestPayout } from "@/lib/payouts";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { checkPayoutRequestRateLimit } from "@/lib/rateLimit";

export async function POST() {
  try {
    const userId = await requireUserId();

    const { allowed, retryAfterSeconds } = await checkPayoutRequestRateLimit(userId);
    if (!allowed) {
      return NextResponse.json({ error: "Too many payout requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }

    const { payoutId } = await requestPayout(userId);
    return NextResponse.json({ payoutId });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
