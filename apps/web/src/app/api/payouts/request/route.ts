import { NextResponse } from "next/server";
import { requestPayout } from "@/lib/payouts";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST() {
  try {
    const userId = await requireUserId();
    const { payoutId } = await requestPayout(userId);
    return NextResponse.json({ payoutId });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
