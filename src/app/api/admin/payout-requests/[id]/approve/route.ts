import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getPlatformPaystackSecret, createTransferRecipient } from "@/lib/payments/paystack";
import { computeLockedUntil, logWalletSecurityEvent, maskAccountNumber } from "@/lib/wallet-security";

/**
 * Applies a merchant's reviewed payout account change. This is the only
 * place a saved BankAccount can actually change after creation — it is
 * intentionally gated behind an admin, not the merchant's own dashboard,
 * since by this point the merchant has already passed password + security
 * question checks and support has (in the real workflow) confirmed the
 * change out of band.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;

    const changeRequest = await prisma.payoutAccountChangeRequest.findUnique({ where: { id } });
    if (!changeRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (changeRequest.status !== "PENDING") {
      return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
    }

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      return NextResponse.json({ error: "Payouts aren't configured on this platform" }, { status: 422 });
    }

    const recipient = await createTransferRecipient(secretKey, {
      name: changeRequest.resolvedAccountName ?? changeRequest.accountNumber,
      accountNumber: changeRequest.accountNumber,
      bankCode: changeRequest.bankCode,
    });

    const lockedUntil = computeLockedUntil();

    const [bankAccount] = await prisma.$transaction([
      prisma.bankAccount.update({
        where: { businessId: changeRequest.businessId },
        data: {
          accountNumber: changeRequest.accountNumber,
          bankCode: changeRequest.bankCode,
          bankName: changeRequest.bankName,
          accountName: changeRequest.resolvedAccountName ?? changeRequest.accountNumber,
          paystackRecipientCode: recipient.recipient_code,
          isVerified: true,
          lockedUntil,
        },
      }),
      prisma.payoutAccountChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
      }),
    ]);

    await logWalletSecurityEvent(
      changeRequest.businessId,
      changeRequest.requestedById,
      "PAYOUT_CHANGE_APPROVED",
      { accountNumber: maskAccountNumber(changeRequest.accountNumber), bankName: changeRequest.bankName }
    );

    return NextResponse.json({ bankAccount });
  } catch (err) {
    return apiError(err);
  }
}
