import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/server/auth/password-reset";
import { confirmResetSchema } from "@/lib/validation/password-reset";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(requestKey(req, "password-reset-confirm"), 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ok = await consumePasswordResetToken(parsed.data.email, parsed.data.token, parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
