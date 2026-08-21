import { NextResponse } from "next/server";

/** Liveness probe — process is up. No dependency checks (spec §74). */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
