import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/**
 * Polled by the wizard UI for state-based progress (spec §55) — never a
 * fabricated percentage, only the real GenerationJobStatus value plus a
 * human-readable errorMessage when failed.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const job = await prisma.generationJob.findUnique({ where: { id: params.id } });
    if (!job) throw new Error("NOT_FOUND");
    if (job.userId !== userId) throw new Error("FORBIDDEN");

    return NextResponse.json({
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        errorMessage: job.errorMessage,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        attempts: job.attempts,
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
