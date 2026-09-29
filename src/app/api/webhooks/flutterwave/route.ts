import { handleProviderWebhook } from "@/lib/payments/webhook-handler";

// Public endpoint -- Flutterwave calls this directly, no session. Security
// is the verif-hash shared-secret check inside handleProviderWebhook.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const { status, body } = await handleProviderWebhook("FLUTTERWAVE", rawBody, req.headers);
  return new Response(body, { status });
}
