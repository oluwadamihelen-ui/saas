import { NextResponse } from "next/server";
import { unpublishProject } from "@cinerra/domain";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/** Removes a project from the public Discover feed. Does not delete the movie itself. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    await unpublishProject({ userId, projectId: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
