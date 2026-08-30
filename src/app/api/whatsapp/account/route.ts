import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  businessId: z.string(),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  displayPhoneNumber: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    await requireBusinessMembership(data.businessId);

    const account = await prisma.whatsAppAccount.upsert({
      where: { businessId: data.businessId },
      create: {
        businessId: data.businessId,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        displayPhoneNumber: data.displayPhoneNumber,
        accessTokenEncrypted: encryptSecret(data.accessToken),
        isConnected: true,
        connectedAt: new Date(),
      },
      update: {
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        displayPhoneNumber: data.displayPhoneNumber,
        accessTokenEncrypted: encryptSecret(data.accessToken),
        isConnected: true,
        connectedAt: new Date(),
      },
    });

    await prisma.business.update({
      where: { id: data.businessId },
      data: { onboardingStep: "PAYMENT" },
    });

    return NextResponse.json({
      account: { ...account, accessTokenEncrypted: undefined },
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

    const account = await prisma.whatsAppAccount.findUnique({ where: { businessId } });
    return NextResponse.json({ account: account ? { ...account, accessTokenEncrypted: undefined } : null });
  } catch (err) {
    return apiError(err);
  }
}
