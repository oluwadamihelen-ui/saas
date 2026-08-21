import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Readiness probe — can this instance actually serve traffic (DB reachable)? */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503 });
  }
}
