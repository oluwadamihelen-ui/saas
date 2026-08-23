import { NextResponse } from "next/server";
import { publishProject } from "@cinerra/domain";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/** Publishes a project to the public Discover feed (spec's publishing/discovery phase). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const publication = await publishProject({ userId, projectId: params.id });
    return NextResponse.json({ publication });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
