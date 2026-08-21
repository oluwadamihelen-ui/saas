import { NextResponse } from "next/server";
import { isTerminal, type GenerationJobStatus } from "@cinerra/domain";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/**
 * Cooperative cancellation (spec §24, §57): flips the job to CANCELLED so
 * the worker's next status check bails out before its next expensive
 * step. A job already mid-provider-call finishes that call but discards
 * the result rather than persisting it.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const job = await prisma.generationJob.findUnique({ where: { id: params.id } });
    if (!job) throw new Error("NOT_FOUND");
    if (job.userId !== userId) throw new Error("FORBIDDEN");

    if (isTerminal(job.status as GenerationJobStatus)) {
      return NextResponse.json({ error: "This generation has already finished and can't be cancelled." }, { status: 409 });
    }

    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "CANCELLED", finishedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
