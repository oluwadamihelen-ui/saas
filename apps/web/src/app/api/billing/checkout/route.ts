import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSubscriptionCheckout } from "@/lib/subscriptions";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  planKey: z.string(),
  interval: z.enum(["MONTH", "YEAR"]),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { planKey, interval } = bodySchema.parse(await request.json());

    const { url } = await createSubscriptionCheckout({ userId, planKey, interval });
    return NextResponse.json({ url });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
