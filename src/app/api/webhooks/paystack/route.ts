import { handleProviderWebhook } from "@/lib/payments/webhook-handler";

// Public endpoint -- Paystack calls this directly, no session. Security is
// the HMAC signature check inside handleProviderWebhook, not auth middleware.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const { status, body } = await handleProviderWebhook("PAYSTACK", rawBody, req.headers);
  return new Response(body, { status });
}
