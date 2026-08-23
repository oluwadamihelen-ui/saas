import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { reorderEpisodeShots } from "@cinerra/domain";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  shotIds: z.array(z.string()).min(1),
});

/** Persists the timeline editor's drag-and-drop shot re-sequencing for an episode. */
export async function POST(request: NextRequest, { params }: { params: { id: string; episodeId: string } }) {
  try {
    const userId = await requireUserId();
    const { shotIds } = bodySchema.parse(await request.json());
    await reorderEpisodeShots({ userId, episodeId: params.episodeId, orderedShotIds: shotIds });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
