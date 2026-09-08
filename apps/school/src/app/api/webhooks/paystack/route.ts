import crypto from "crypto";
import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { findCredentialForReference, confirmReferenceEverywhere } from "@/lib/payments/webhook-helpers";

/// Paystack signs the raw request body with HMAC-SHA512 using the
/// school's own secret key — signed against the exact bytes sent, so the
/// body must be read as raw text before any JSON.parse, and the school
/// whose secret key to verify against is looked up by the event's own
/// reference (a webhook has no session, unlike a dashboard request).
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const credential = await findCredentialForReference("PAYSTACK", reference);
  if (!credential || !credential.isEnabled) return NextResponse.json({ error: "Unknown reference" }, { status: 404 });

  const signature = req.headers.get("x-paystack-signature");
  const secretKey = decryptSecret(credential.secretKeyEnc);
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.event === "charge.success") {
    await confirmReferenceEverywhere(reference);
  }
  return NextResponse.json({ received: true });
}
