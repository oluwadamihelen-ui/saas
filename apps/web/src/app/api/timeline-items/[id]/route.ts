import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateTimelineItemMix } from "@cinerra/domain";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  volume: z.number().min(0).max(2).optional(),
  muted: z.boolean().optional(),
});

/** The timeline editor's per-track (dialogue/SFX/score) volume and mute control. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const { volume, muted } = bodySchema.parse(await request.json());
    const item = await updateTimelineItemMix({ userId, timelineItemId: params.id, volume, muted });
    return NextResponse.json({ timelineItem: item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
