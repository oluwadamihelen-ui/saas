import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { recordViewingEvent, ProjectNotFoundError } from "@/lib/viewingEvents";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  projectId: z.string(),
  episodeId: z.string().nullable(),
  type: z.enum(["STARTED", "QUARTER", "HALF", "THREE_QUARTER", "COMPLETED"]),
});

/**
 * Anonymous-or-authenticated, same null-safe pattern as
 * /api/content/[scope]/[id]/access — a viewer watching free/public
 * content without an account is a real viewing event, not an error.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const { projectId, episodeId, type } = bodySchema.parse(await request.json());
    await recordViewingEvent({ userId, projectId, episodeId, type });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return toApiErrorResponse(error);
  }
}
