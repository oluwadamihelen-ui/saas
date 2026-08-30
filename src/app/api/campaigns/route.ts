import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";
import { getCustomersBySegmentType } from "@/lib/analytics/queries";

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    await requireBusinessMembership(businessId);

    const campaigns = await prisma.campaign.findMany({
      where: { businessId },
      include: { recipients: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ campaigns });
  } catch (err) {
    return apiError(err);
  }
}

const schema = z.object({
  businessId: z.string(),
  name: z.string().min(1),
  message: z.string().min(1).max(1000),
  segmentType: z.enum(["NEW", "RETURNING", "VIP", "HIGH_VALUE", "INACTIVE", "CUSTOM"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    await requireBusinessMembership(data.businessId);

    const recipients =
      data.segmentType === "CUSTOM"
        ? []
        : await getCustomersBySegmentType(data.businessId, data.segmentType);

    const campaign = await prisma.campaign.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        message: data.message,
        segmentType: data.segmentType,
        status: "DRAFT",
        recipients: { create: recipients.map((c) => ({ customerId: c.id })) },
      },
      include: { recipients: true },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
