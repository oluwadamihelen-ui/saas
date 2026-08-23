import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { getWalletBalance } from "@/lib/wallet";

export async function GET() {
  try {
    const userId = await requireUserId();
    const balance = await getWalletBalance(userId);
    return NextResponse.json({ balance });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
