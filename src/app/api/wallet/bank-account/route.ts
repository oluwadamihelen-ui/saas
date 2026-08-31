import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getPlatformPaystackSecret, resolveAccountNumber, createTransferRecipient, listNigerianBanks } from "@/lib/payments/paystack";
import {
  requireCurrentPassword,
  accountNameLikelyMatches,
  computeLockedUntil,
  logWalletSecurityEvent,
  maskAccountNumber,
  hashSecurityAnswer,
  SECURITY_QUESTIONS,
} from "@/lib/wallet-security";

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
  currentPassword: z.string().optional(),
  securityAnswers: z.array(z.string().min(1)).length(SECURITY_QUESTIONS.length).optional(),
});

/**
 * Verifies + saves a payout destination using ONLY the platform's own
 * Paystack key — the merchant never needs their own Paystack account for
 * this. Only ever creates the account: once one exists for a business, this
 * route refuses and the merchant must go through the reviewed
 * PayoutAccountChangeRequest flow (POST /api/wallet/bank-account/change-request)
 * instead. There is deliberately no self-service edit or delete — a saved
 * payout account is the single highest-value takeover target in the wallet
 * system, so changing it always needs a human at support to sign off.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER"]);
    await requireCurrentPassword(membership.userId, data.currentPassword);

    const existing = await prisma.bankAccount.findUnique({ where: { businessId: data.businessId } });
    if (existing) {
      return NextResponse.json(
        {
          error:
            "You already have a payout account on file, and it can't be edited from here. Submit a change request instead — it's only applied after our support team verifies your identity.",
        },
        { status: 403 }
      );
    }

    if (!data.securityAnswers) {
      return NextResponse.json(
        {
          error: `Answer all ${SECURITY_QUESTIONS.length} security questions to set up your payout account. These are what you'll need to reproduce if you ever need to change it.`,
          securityQuestions: SECURITY_QUESTIONS,
        },
        { status: 422 }
      );
    }

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      return NextResponse.json({ error: "Payouts aren't configured on this platform yet" }, { status: 422 });
    }

    const [resolved, business] = await Promise.all([
      resolveAccountNumber(secretKey, data.accountNumber, data.bankCode),
      prisma.business.findUniqueOrThrow({ where: { id: data.businessId } }),
    ]);

    const recipient = await createTransferRecipient(secretKey, {
      name: resolved.account_name,
      accountNumber: data.accountNumber,
      bankCode: data.bankCode,
    });

    const banks = await listNigerianBanks(secretKey).catch(() => []);
    const bankName = banks.find((b) => b.code === data.bankCode)?.name;
    const lockedUntil = computeLockedUntil();

    const answerHashes = await Promise.all(data.securityAnswers.map(hashSecurityAnswer));

    const [bankAccount] = await prisma.$transaction([
      prisma.bankAccount.create({
        data: {
          businessId: data.businessId,
          accountNumber: data.accountNumber,
          bankCode: data.bankCode,
          bankName,
          accountName: resolved.account_name,
          paystackRecipientCode: recipient.recipient_code,
          isVerified: true,
          lockedUntil,
        },
      }),
      ...SECURITY_QUESTIONS.map((question, i) =>
        prisma.securityAnswer.create({
          data: { businessId: data.businessId, question, answerHash: answerHashes[i] },
        })
      ),
    ]);

    await logWalletSecurityEvent(
      data.businessId,
      membership.userId,
      "BANK_ACCOUNT_ADDED",
      { accountNumber: maskAccountNumber(data.accountNumber), bankName },
      req.headers.get("x-forwarded-for") ?? undefined
    );

    const nameMismatch = !accountNameLikelyMatches(resolved.account_name, business.ownerName, business.name);

    return NextResponse.json({
      bankAccount,
      nameMismatch,
      lockedUntil,
    });
  } catch (err) {
    return apiError(err);
  }
}
