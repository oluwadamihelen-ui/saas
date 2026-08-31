import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getPlatformPaystackSecret, resolveAccountNumber, listNigerianBanks } from "@/lib/payments/paystack";
import {
  requireCurrentPassword,
  verifyAllSecurityAnswers,
  logWalletSecurityEvent,
  maskAccountNumber,
  SECURITY_QUESTIONS,
} from "@/lib/wallet-security";

const schema = z.object({
  businessId: z.string(),
  accountNumber: z.string().min(10).max(10),
  bankCode: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
  currentPassword: z.string().optional(),
  securityAnswers: z.array(z.string().min(1)).length(SECURITY_QUESTIONS.length),
});

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const requests = await prisma.payoutAccountChangeRequest.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return NextResponse.json({ requests });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * The only way to change an already-saved payout bank account. Getting this
 * far requires the current password AND every security-question answer to
 * match what was set up when the account was first added — but even then it
 * does not change anything by itself. It creates a PENDING request that only
 * takes effect once a platform admin reviews and approves it (typically
 * after contacting the merchant directly to double-check), from
 * /admin/payout-requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER"]);
    await requireCurrentPassword(membership.userId, data.currentPassword);

    const existing = await prisma.bankAccount.findUnique({ where: { businessId: data.businessId } });
    if (!existing) {
      return NextResponse.json(
        { error: "No payout account on file yet — add one first from the wallet page." },
        { status: 422 }
      );
    }

    const answersMatch = await verifyAllSecurityAnswers(data.businessId, data.securityAnswers);
    if (!answersMatch) {
      await logWalletSecurityEvent(
        data.businessId,
        membership.userId,
        "PAYOUT_CHANGE_DENIED",
        {},
        req.headers.get("x-forwarded-for") ?? undefined
      );
      return NextResponse.json(
        {
          error:
            "One or more answers didn't match our records. If you don't remember them, contact support directly — we'll verify your identity another way.",
        },
        { status: 401 }
      );
    }

    const pending = await prisma.payoutAccountChangeRequest.findFirst({
      where: { businessId: data.businessId, status: "PENDING" },
    });
    if (pending) {
      return NextResponse.json(
        { error: "You already have a payout account change request pending review." },
        { status: 409 }
      );
    }

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      return NextResponse.json({ error: "Payouts aren't configured on this platform yet" }, { status: 422 });
    }

    const resolved = await resolveAccountNumber(secretKey, data.accountNumber, data.bankCode);
    const banks = await listNigerianBanks(secretKey).catch(() => []);
    const bankName = banks.find((b) => b.code === data.bankCode)?.name;

    const changeRequest = await prisma.payoutAccountChangeRequest.create({
      data: {
        businessId: data.businessId,
        requestedById: membership.userId,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        bankName,
        resolvedAccountName: resolved.account_name,
        reason: data.reason,
      },
    });

    await logWalletSecurityEvent(
      data.businessId,
      membership.userId,
      "PAYOUT_CHANGE_REQUESTED",
      { accountNumber: maskAccountNumber(data.accountNumber), bankName },
      req.headers.get("x-forwarded-for") ?? undefined
    );

    return NextResponse.json({ changeRequest }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
