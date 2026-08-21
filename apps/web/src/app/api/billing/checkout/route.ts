import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createCheckoutSession, createStripeClient } from "@cinerra/billing";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { env } from "@/lib/env";

const bodySchema = z.object({
  planKey: z.string(),
  interval: z.enum(["MONTH", "YEAR"]),
});

export async function POST(request: NextRequest) {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Billing isn't configured yet. Add STRIPE_SECRET_KEY to enable subscriptions." }, { status: 503 });
    }

    const userId = await requireUserId();
    const { planKey, interval } = bodySchema.parse(await request.json());

    const [user, plan] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.plan.findUniqueOrThrow({ where: { key: planKey } }),
    ]);

    const priceId = interval === "MONTH" ? plan.stripePriceIdMonthly : plan.stripePriceIdYearly;
    if (!priceId) {
      return NextResponse.json({ error: "This plan isn't available for checkout yet. An admin needs to attach a Stripe price ID." }, { status: 503 });
    }

    const existingSubscription = await prisma.subscription.findUnique({ where: { userId } });
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

    const session = await createCheckoutSession(stripe, {
      priceId,
      userId,
      customerEmail: user.email,
      existingStripeCustomerId: existingSubscription?.stripeCustomerId ?? undefined,
      successUrl: `${env.APP_BASE_URL}/pricing?checkout=success`,
      cancelUrl: `${env.APP_BASE_URL}/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
