import { NextRequest, NextResponse } from "next/server";
import { verifyLicense, verifyLicenseSchema } from "@/lib/services/licenses";
import { logger } from "@/lib/security/logger";

/**
 * Public license-verification endpoint: a deployed customer application
 * calls this with its own license key (and optionally its own domain) to
 * confirm it's still authorized to run. The license key itself is the
 * credential -- no additional auth on this route, same as any license/API
 * key verification endpoint.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = verifyLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, reason: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const result = await verifyLicense(parsed.data.licenseKey, parsed.data.domain);
    return NextResponse.json(result, { status: result.valid ? 200 : 403 });
  } catch (error) {
    logger.error("license.verify_failed", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ valid: false, reason: "Verification is temporarily unavailable. Please try again shortly." }, { status: 502 });
  }
}
