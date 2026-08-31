import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { debitWallet, creditWallet } from "@/lib/wallet";
import { getPlatformPaystackSecret, initiateTransfer } from "@/lib/payments/paystack";
import { requireCurrentPassword, logWalletSecurityEvent, maskAccountNumber } from "@/lib/wallet-security";
import { formatCurrency } from "@/lib/utils";

const schema = z.object({
  businessId: z.string(),
  amount: z.coerce.number().positive(),
  currentPassword: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER"]);
    await requireCurrentPassword(membership.userId, data.currentPassword);

    const bankAccount = await prisma.bankAccount.findUnique({ where: { businessId: data.businessId } });
    if (!bankAccount?.isVerified || !bankAccount.paystackRecipientCode) {
      return NextResponse.json({ error: "Add and verify a bank account before withdrawing" }, { status: 422 });
    }
    if (bankAccount.lockedUntil && bankAccount.lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: `Your payout account was recently added or changed. For your security, withdrawals are locked until ${bankAccount.lockedUntil.toLocaleString()} so you have time to notice and report a change that wasn't yours.`,
        },
        { status: 423 }
      );
    }

    const payout = await prisma.payoutRequest.create({
      data: { businessId: data.businessId, amount: data.amount, status: "PENDING" },
    });

    // Debit first — atomically rejects the request if the balance can't
    // cover it, before we ever call out to Paystack.
    try {
      await debitWallet(data.businessId, data.amount, "WITHDRAWAL", {
        payoutId: payout.id,
        description: `Withdrawal request ${payout.id}`,
      });
    } catch (err) {
      await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: "FAILED", failureReason: "Insufficient wallet balance" },
      });
      throw err;
    }

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      await creditWallet(data.businessId, data.amount, "WITHDRAWAL_REVERSAL", {
        payoutId: payout.id,
        description: "Payouts aren't configured on this platform yet",
      });
      await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: "FAILED", failureReason: "Payouts not configured" },
      });
      return NextResponse.json({ error: "Payouts aren't configured on this platform yet" }, { status: 422 });
    }

    try {
      const transfer = await initiateTransfer(secretKey, {
        amountKobo: Math.round(data.amount * 100),
        recipientCode: bankAccount.paystackRecipientCode,
        reason: `MAMA withdrawal ${payout.id}`,
        reference: payout.id,
      });

      const updated = await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: "PROCESSING", paystackTransferCode: transfer.transfer_code },
      });

      await logWalletSecurityEvent(
        data.businessId,
        membership.userId,
        "WITHDRAWAL_REQUESTED",
        { amount: formatCurrency(data.amount), accountNumber: maskAccountNumber(bankAccount.accountNumber) },
        req.headers.get("x-forwarded-for") ?? undefined
      );

      return NextResponse.json({ payout: updated }, { status: 201 });
    } catch (err) {
      // The transfer call itself failed synchronously (bad recipient, no
      // platform balance, etc.) — refund immediately rather than waiting
      // on a webhook that will never arrive for a transfer that was never created.
      await creditWallet(data.businessId, data.amount, "WITHDRAWAL_REVERSAL", {
        payoutId: payout.id,
        description: "Withdrawal request failed",
      });
      await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: "FAILED", failureReason: err instanceof Error ? err.message : "Unknown error" },
      });
      throw err;
    }
  } catch (err) {
    return apiError(err);
  }
}
