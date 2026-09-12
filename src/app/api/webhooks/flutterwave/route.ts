import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { findCredentialForReference, confirmReferenceEverywhere } from "@/lib/payments/webhook-helpers";

/// Flutterwave doesn't sign the body — it just echoes back a fixed
/// "secret hash" string (verif-hash header) that a school sets separately
/// in their Flutterwave dashboard's webhook settings, unrelated to their
/// API keys. A school that hasn't set PaymentGatewayCredential.webhookSecretEnc
/// simply has no webhook verification path; the confirm page's own
/// server-side verify() call still works regardless.
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event: { event?: string; data?: { tx_ref?: string; status?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = event.data?.tx_ref;
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const credential = await findCredentialForReference("FLUTTERWAVE", reference);
  if (!credential || !credential.isEnabled || !credential.webhookSecretEnc) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 404 });
  }

  const signature = req.headers.get("verif-hash");
  const expected = decryptSecret(credential.webhookSecretEnc);
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.data?.status === "successful") {
    await confirmReferenceEverywhere(reference);
  }
  return NextResponse.json({ received: true });
}
