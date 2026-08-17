import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/server/auth/password-reset";
import { requestResetSchema } from "@/lib/validation/password-reset";
import { rateLimit, requestKey } from "@/lib/rate-limit";

// No transactional email provider is configured yet (see .env.example —
// this is a Phase F wiring task). In development we return the reset link
// directly in the response so the flow is fully testable end-to-end; in
// production we never do this, since it would leak account existence and
// hand out working reset links over the API.
export async function POST(req: Request) {
  if (!rateLimit(requestKey(req, "password-reset"), 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const token = await createPasswordResetToken(parsed.data.email);

  if (process.env.NODE_ENV !== "production" && token) {
    const resetUrl = `/reset-password/confirm?email=${encodeURIComponent(parsed.data.email)}&token=${token}`;
    return NextResponse.json({
      ok: true,
      devNote: "No email provider is configured — this link is shown only in development.",
      devResetUrl: resetUrl,
    });
  }

  return NextResponse.json({ ok: true });
}
