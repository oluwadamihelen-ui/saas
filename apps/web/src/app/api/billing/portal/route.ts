import { NextResponse } from "next/server";
import { createPortalSession, createStripeClient } from "@cinerra/billing";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { env } from "@/lib/env";

export async function POST() {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Billing isn't configured yet." }, { status: 503 });
    }
    const userId = await requireUserId();
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "You don't have an active subscription yet." }, { status: 404 });
    }

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const session = await createPortalSession(stripe, subscription.stripeCustomerId, `${env.APP_BASE_URL}/pricing`);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
