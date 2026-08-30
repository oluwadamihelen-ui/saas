import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";

const schema = z.object({
  businessId: z.string(),
  name: z.string().min(2).optional(),
  timezone: z.string().optional(),
  lowStockAlertEmail: z.boolean().optional(),
  storefrontEnabled: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER", "ADMIN"]);

    if (data.name) {
      await prisma.business.update({ where: { id: data.businessId }, data: { name: data.name } });
    }

    const settings = await prisma.businessSettings.upsert({
      where: { businessId: data.businessId },
      create: {
        businessId: data.businessId,
        timezone: data.timezone ?? "Africa/Lagos",
        lowStockAlertEmail: data.lowStockAlertEmail ?? true,
        storefrontEnabled: data.storefrontEnabled ?? true,
      },
      update: {
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.lowStockAlertEmail !== undefined ? { lowStockAlertEmail: data.lowStockAlertEmail } : {}),
        ...(data.storefrontEnabled !== undefined ? { storefrontEnabled: data.storefrontEnabled } : {}),
      },
    });

    return NextResponse.json({ settings });
  } catch (err) {
    return apiError(err);
  }
}
