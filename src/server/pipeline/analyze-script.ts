import { prisma } from "@/server/db/client";
import { getAIProvider } from "@/server/providers";
import { applyCreditDelta, InsufficientCreditsError } from "@/server/credits/ledger";
import { CREDIT_COSTS } from "@/lib/plans";

export async function runScriptAnalysis(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      stage: "SCRIPT_ANALYSIS",
      provider: getAIProvider().name,
      status: "PROCESSING",
      startedAt: new Date(),
      creditsCost: CREDIT_COSTS.SCRIPT_GENERATION,
    },
  });

  try {
    await applyCreditDelta(project.userId, -CREDIT_COSTS.SCRIPT_GENERATION, "SCRIPT_GENERATION", { projectId });

    const analysis = await getAIProvider().analyzeScript({
      idea: project.idea ?? undefined,
      script: project.script ?? undefined,
      language: project.language,
    });

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date(), metadata: analysis as never },
    });

    await prisma.project.update({ where: { id: projectId }, data: { status: "SCRIPT_READY" } });

    return analysis;
  } catch (err) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: err instanceof InsufficientCreditsError ? "Not enough credits." : errorMessage(err),
      },
    });
    throw err;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
