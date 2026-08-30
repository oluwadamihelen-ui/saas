import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/tenant";
import { apiError } from "@/lib/api-helpers";

const schema = z.object({ businessId: z.string(), planKey: z.enum(["FREE", "GROWTH", "PRO"]) });

/**
 * Changes the business's plan directly. In production this would sit
 * behind a real Paystack subscription charge — MAMA already has the
 * Paystack integration this would build on (lib/payments/paystack.ts) —
 * but wiring recurring billing is out of scope for this MVP, so plan
 * changes here are immediate and unbilled. See README "Known limitations".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const membership = await requireBusinessMembership(data.businessId);
    requireRole(membership, ["OWNER", "ADMIN"]);

    const plan = await prisma.plan.findUnique({ where: { key: data.planKey } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const subscription = await prisma.subscription.upsert({
      where: { businessId: data.businessId },
      create: { businessId: data.businessId, planId: plan.id, status: "ACTIVE" },
      update: { planId: plan.id, status: "ACTIVE" },
      include: { plan: true },
    });

    return NextResponse.json({ subscription });
  } catch (err) {
    return apiError(err);
  }
}
