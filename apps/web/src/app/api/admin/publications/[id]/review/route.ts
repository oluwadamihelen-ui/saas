import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { reviewPublication } from "@cinerra/domain";
import { requireAdmin } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(2000).optional(),
});

/** Admin approve/reject action on the Discover moderation queue. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminUserId = await requireAdmin();
    const { decision, notes } = bodySchema.parse(await request.json());
    const publication = await reviewPublication({ moderatorUserId: adminUserId, publicationId: params.id, decision, notes });
    return NextResponse.json({ publication });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
