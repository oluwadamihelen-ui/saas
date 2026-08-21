import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const createProjectSchema = z.object({
  title: z.string().min(1).max(70),
  mode: z.enum(["INSPIRATION", "ADAPTATION"]),
  format: z.enum(["SHORT_FILM", "FEATURE_FILM", "MINI_SERIES", "SERIES"]).default("SERIES"),
  episodeCount: z.number().int().min(1).max(200).default(1),
  aspectRatio: z.enum(["LANDSCAPE_16_9", "PORTRAIT_9_16", "SQUARE_1_1"]).default("PORTRAIT_9_16"),
  visualStyle: z
    .enum([
      "LIVE_ACTION_FILM",
      "CINEMATIC_DRAMA",
      "DOCUMENTARY",
      "DARK_THRILLER",
      "ROMANTIC_DRAMA",
      "HIGH_END_TELEVISION",
      "PERIOD_DRAMA",
      "ACTION_FILM",
      "HORROR",
      "CUSTOM",
    ])
    .default("CINEMATIC_DRAMA"),
  customStyle: z.string().optional(),
  sourceText: z.string().optional(),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const projects = await prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: { storyBible: true, episodes: { select: { id: true, number: true, status: true } } },
    });
    return NextResponse.json({ projects });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = createProjectSchema.parse(await request.json());

    const project = await prisma.project.create({
      data: {
        ownerId: userId,
        title: body.title,
        mode: body.mode,
        format: body.format,
        episodeCount: body.episodeCount,
        aspectRatio: body.aspectRatio,
        visualStyle: body.visualStyle,
        customStyle: body.customStyle,
        sourceText: body.sourceText,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
