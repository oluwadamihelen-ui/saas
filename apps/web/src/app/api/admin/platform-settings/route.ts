import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";
import { updatePlatformSettings, InvalidPriceRangeError } from "@/lib/platformSettings";

const bodySchema = z.object({
  publisherRevenueShareBps: z.number().int().min(0).max(10000),
  settlementPeriodDays: z.number().int().min(0),
  payoutMinimumCoins: z.number().int().min(1),
  payoutCoinValueCents: z.number().int().min(1),
  payoutCurrency: z.string().min(1).max(10),
  minMovieCoinPrice: z.number().int().min(1),
  maxMovieCoinPrice: z.number().int().min(1),
  minEpisodeCoinPrice: z.number().int().min(1),
  maxEpisodeCoinPrice: z.number().int().min(1),
  minSceneCoinPrice: z.number().int().min(1),
  maxSceneCoinPrice: z.number().int().min(1),
  doeCostPerReferenceImage: z.number().int().min(0),
  doeCostPerVideoSecond: z.number().int().min(0),
});

/**
 * Full-detail admin view — unlike the public /api/platform-settings route,
 * which only exposes the fields a creator needs to preview pricing before
 * publishing (spec §22-23), this includes payout economics that were
 * never meant to be public (payoutCoinValueCents in particular directly
 * reveals the platform's margin on a coin).
 */
export async function GET() {
  try {
    await requireAdmin();
    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    return NextResponse.json(settings);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = bodySchema.parse(await request.json());
    const settings = await updatePlatformSettings(body);
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof InvalidPriceRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
