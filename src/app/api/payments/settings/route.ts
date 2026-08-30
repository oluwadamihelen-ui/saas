import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  businessId: z.string(),
  paystackPublicKey: z.string().min(1),
  paystackSecretKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    await requireBusinessMembership(data.businessId);

    const settings = await prisma.paymentSettings.upsert({
      where: { businessId: data.businessId },
      create: {
        businessId: data.businessId,
        paystackPublicKey: data.paystackPublicKey,
        paystackSecretKeyEncrypted: encryptSecret(data.paystackSecretKey),
        isConnected: true,
      },
      update: {
        paystackPublicKey: data.paystackPublicKey,
        paystackSecretKeyEncrypted: encryptSecret(data.paystackSecretKey),
        isConnected: true,
      },
    });

    await prisma.business.update({
      where: { id: data.businessId },
      data: { onboardingStep: "COMPLETE", onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({
      settings: { ...settings, paystackSecretKeyEncrypted: undefined },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const settings = await prisma.paymentSettings.findUnique({ where: { businessId } });
    return NextResponse.json({
      settings: settings ? { ...settings, paystackSecretKeyEncrypted: undefined } : null,
    });
  } catch (err) {
    return apiError(err);
  }
}
