import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/api-helpers";
import { getPlatformPaystackSecret, listNigerianBanks } from "@/lib/payments/paystack";

// Just needs any signed-in user — the bank list isn't tenant-scoped data.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      return NextResponse.json({ error: "Payouts aren't configured on this platform yet" }, { status: 422 });
    }

    const banks = await listNigerianBanks(secretKey);
    return NextResponse.json({ banks });
  } catch (err) {
    return apiError(err);
  }
}
