import { handleProviderWebhook } from "@/lib/payments/webhook-handler";

// Public endpoint -- Kora Pay calls this directly, no session. Security is
// the HMAC signature check (over the `data` object) inside handleProviderWebhook.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const { status, body } = await handleProviderWebhook("KORAPAY", rawBody, req.headers);
  return new Response(body, { status });
}
