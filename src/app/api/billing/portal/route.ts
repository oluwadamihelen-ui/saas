import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { isStripeConfigured } from "@/server/billing/stripe";
import { createBillingPortalUrl } from "@/server/billing/checkout";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Billing isn't configured yet on this deployment." }, { status: 503 });
    }
    if (!rateLimit(requestKey(req, `billing-portal:${userId}`), 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const url = await createBillingPortalUrl(userId);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not open billing portal." }, { status: 400 });
  }
}
