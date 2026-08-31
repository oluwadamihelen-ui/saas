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
});

/**
 * Verifies + saves a payout destination using ONLY the platform's own
 * Paystack key — the merchant never needs their own Paystack account for
 * this. Locked down against takeover: only the business OWNER can call
 * this, the caller must re-confirm their password, and every add/change
 * starts a 24h withdrawal cooldown plus an audit log entry + in-app alert
 * (see lib/wallet-security.ts) so a change that wasn't really the owner
 * has a window to be caught before any money can move.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER"]);
    await requireCurrentPassword(membership.userId, data.currentPassword);

    const secretKey = getPlatformPaystackSecret();
    if (!secretKey) {
      return NextResponse.json({ error: "Payouts aren't configured on this platform yet" }, { status: 422 });
    }

    const [resolved, existing, business] = await Promise.all([
      resolveAccountNumber(secretKey, data.accountNumber, data.bankCode),
      prisma.bankAccount.findUnique({ where: { businessId: data.businessId } }),
      prisma.business.findUniqueOrThrow({ where: { id: data.businessId } }),
    ]);

    const recipient = await createTransferRecipient(secretKey, {
      name: resolved.account_name,
      accountNumber: data.accountNumber,
      bankCode: data.bankCode,
    });

    const banks = await listNigerianBanks(secretKey).catch(() => []);
    const bankName = banks.find((b) => b.code === data.bankCode)?.name;

    const isChange = Boolean(existing);
    const lockedUntil = computeLockedUntil();

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
        lockedUntil,
      },
      update: {
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        bankName,
        accountName: resolved.account_name,
        paystackRecipientCode: recipient.recipient_code,
        isVerified: true,
        lockedUntil,
      },
    });

    await logWalletSecurityEvent(
      data.businessId,
      membership.userId,
      isChange ? "BANK_ACCOUNT_CHANGED" : "BANK_ACCOUNT_ADDED",
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
