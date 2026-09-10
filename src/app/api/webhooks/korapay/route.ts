import crypto from "crypto";
import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { findCredentialForReference, confirmReferenceEverywhere } from "@/lib/payments/webhook-helpers";

/// Korapay signs just the event's data object (not the whole body) with
/// HMAC-SHA256 using the school's own secret key, hex-encoded in the
/// x-korapay-signature header.
export async function POST(req: Request) {
  let event: { event?: string; data?: { reference?: string; status?: string } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  const credential = await findCredentialForReference("KORAPAY", reference);
  if (!credential || !credential.isEnabled) return NextResponse.json({ error: "Unknown reference" }, { status: 404 });

  const signature = req.headers.get("x-korapay-signature");
  const secretKey = decryptSecret(credential.secretKeyEnc);
  const expected = crypto.createHmac("sha256", secretKey).update(JSON.stringify(event.data)).digest("hex");
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.data?.status === "success") {
    await confirmReferenceEverywhere(reference);
  }
  return NextResponse.json({ received: true });
}
