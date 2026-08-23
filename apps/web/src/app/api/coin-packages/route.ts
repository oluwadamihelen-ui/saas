import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toApiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const packages = await prisma.coinPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ packages });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
