import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getPlatformPaystackSecret, resolveAccountNumber, createTransferRecipient, listNigerianBanks } from "@/lib/payments/paystack";

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const bankAccount = await prisma.bankAccount.findUnique({ where: { businessId } });
    return NextResponse.json({ bankAccount });
  } catch (err) {
    return apiError(err);
  }
}

const schema = z.object({
  businessId: z.string(),
  accountNumber: z.string().min(10).max(10),
  bankCode: z.string().min(1),
});

/**
 * Verifies + saves a payout destination using ONLY the platform's own
 * Paystack key — the merchant never needs their own Paystack account for
 * this. Paystack's bank-lookup API confirms the account is real and whose
 * name it's under; we show that name back so the merchant can catch a
 * typo before it's saved, rather than trusting what they typed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER", "ADMIN"]);

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      return NextResponse.json({ error: "Payouts aren't configured on this platform yet" }, { status: 422 });
    }

    const resolved = await resolveAccountNumber(secretKey, data.accountNumber, data.bankCode);
    const recipient = await createTransferRecipient(secretKey, {
      name: resolved.account_name,
      accountNumber: data.accountNumber,
      bankCode: data.bankCode,
    });

    const banks = await listNigerianBanks(secretKey).catch(() => []);
    const bankName = banks.find((b) => b.code === data.bankCode)?.name;

    const bankAccount = await prisma.bankAccount.upsert({
      where: { businessId: data.businessId },
      create: {
        businessId: data.businessId,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        bankName,
        accountName: resolved.account_name,
        paystackRecipientCode: recipient.recipient_code,
        isVerified: true,
      },
      update: {
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        bankName,
        accountName: resolved.account_name,
        paystackRecipientCode: recipient.recipient_code,
        isVerified: true,
      },
    });

    return NextResponse.json({ bankAccount });
  } catch (err) {
    return apiError(err);
  }
}
