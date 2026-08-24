import { NextResponse } from "next/server";
import { cancelSubscription } from "@/lib/subscriptions";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST() {
  try {
    const userId = await requireUserId();
    await cancelSubscription(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
