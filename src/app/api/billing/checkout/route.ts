import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { isStripeConfigured } from "@/server/billing/stripe";
import { createSubscriptionCheckoutUrl } from "@/server/billing/checkout";
import { checkoutPlanSchema } from "@/lib/validation/billing";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Billing isn't configured yet on this deployment." }, { status: 503 });
    }
    if (!rateLimit(requestKey(req, `checkout:${userId}`), 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutPlanSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

    const url = await createSubscriptionCheckoutUrl(userId, parsed.data.plan);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start checkout." }, { status: 400 });
  }
}
