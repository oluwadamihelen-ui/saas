import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toApiErrorResponse } from "@/lib/apiError";

/** Public, read-only: the bits of PlatformSettings a creator needs to preview pricing before publishing (spec §22-23). No secrets here. */
export async function GET() {
  try {
    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    return NextResponse.json({
      publisherRevenueShareBps: settings.publisherRevenueShareBps,
      minMovieCoinPrice: settings.minMovieCoinPrice,
      maxMovieCoinPrice: settings.maxMovieCoinPrice,
      minEpisodeCoinPrice: settings.minEpisodeCoinPrice,
      maxEpisodeCoinPrice: settings.maxEpisodeCoinPrice,
      minSceneCoinPrice: settings.minSceneCoinPrice,
      maxSceneCoinPrice: settings.maxSceneCoinPrice,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
