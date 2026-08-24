import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectPayoutAccount } from "@/lib/payouts";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  provider: z.enum(["PAYSTACK", "KORAPAY"]),
  bankCode: z.string().min(1),
  accountNumber: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { provider, bankCode, accountNumber } = bodySchema.parse(await request.json());
    const account = await connectPayoutAccount(userId, { provider, bankCode, accountNumber });
    return NextResponse.json({ accountName: account.accountName, provider: account.provider, bankCode: account.bankCode, accountNumber: account.accountNumber });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
