import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDomainProvider } from "@/lib/providers/registry";
import { logger } from "@/lib/security/logger";

const DEFAULT_TLDS = ["com", "ng", "org", "net", "co", "io", "app"];

const querySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters")
    .max(63)
    .regex(/^[a-zA-Z0-9-]+$/, "Only letters, numbers and hyphens are allowed"),
});

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  try {
    const provider = await getDomainProvider();
    const results = await provider.searchDomain(parsed.data.q, DEFAULT_TLDS);
    return NextResponse.json({ results });
  } catch (error) {
    logger.error("domains.search_failed", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Unable to search domains right now. Please try again shortly." }, { status: 502 });
  }
}
