import { NextResponse } from "next/server";
import { resolveActivePartnerByCode, PARTNER_REFERRAL_COOKIE_NAME } from "@/lib/services/partner-referrals";
import { getPartnerCommissionConfig } from "@/lib/services/partner-commissions";

/// Public — no login. A Partner's own shareable link
/// (schoolum.example/r/THEIRCODE): sets a short-lived, httpOnly cookie
/// naming the code they used and sends the visitor straight to /register.
/// This is only ever a hint for later — resolveActivePartnerByCode() is
/// re-run against the live table again at actual registration time
/// (getPendingPartnerReferralFromCookie), so a code that stops being
/// ACTIVE between the click and the signup produces no attribution rather
/// than a stale one.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const registerUrl = new URL("/register", _req.url);

  const partner = await resolveActivePartnerByCode(code);
  if (!partner) return NextResponse.redirect(registerUrl);

  const config = await getPartnerCommissionConfig();
  const response = NextResponse.redirect(registerUrl);
  response.cookies.set(PARTNER_REFERRAL_COOKIE_NAME, code.trim().toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: config.attributionWindowDays * 24 * 60 * 60,
  });
  return response;
}
