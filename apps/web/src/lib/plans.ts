import { prisma } from "./db";

/**
 * Each plan's monthly Doe allowance (Plan.includedGenerationDoe) was
 * seed-only until now — the only way to change it was direct database
 * access. Updates every plan in one transaction so a partial save (e.g. a
 * write failing halfway through) can never leave the plans' allowances in
 * a state that was never actually submitted together.
 */
export async function updatePlanDoeAllowances(updates: { planId: string; includedGenerationDoe: number }[]): Promise<void> {
  await prisma.$transaction(
    updates.map((u) => prisma.plan.update({ where: { id: u.planId }, data: { includedGenerationDoe: u.includedGenerationDoe } })),
  );
}
