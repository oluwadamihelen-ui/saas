import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

export const submitApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  categoryId: z.string().uuid(),
  shortDescription: z.string().trim().min(1).max(500),
  fullDescription: z.string().trim().min(1),
  licensePrice: z.coerce.number().positive(),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;

/**
 * A developer's app submission goes in as DRAFT -- it's not purchasable or
 * even visible until an admin reviews it, fills in a deployment
 * specification via the existing "New Version" admin flow, and publishes it
 * the same way any admin-authored app is published. This intentionally
 * doesn't try to replicate that whole review surface; it just gets a
 * developer's app into the same moderation queue admins already use.
 */
export async function submitApplication(developerId: string, input: SubmitApplicationInput) {
  const existing = await prisma.application.findUnique({ where: { slug: input.slug } });
  if (existing) throw new Error(`An application with slug "${input.slug}" already exists.`);

  const application = await prisma.application.create({
    data: {
      name: input.name,
      slug: input.slug,
      categoryId: input.categoryId,
      shortDescription: input.shortDescription,
      fullDescription: input.fullDescription,
      status: "DRAFT",
      createdById: developerId,
      pricing: { create: { type: "LICENSE", name: "Software License", amount: input.licensePrice, billingCycle: "ONE_TIME" } },
    },
  });

  await recordAuditLog({
    actorId: developerId,
    action: "application.submitted",
    resourceType: "Application",
    resourceId: application.id,
    newValue: { name: application.name },
  });
  logger.info("developer.application_submitted", { applicationId: application.id, developerId });

  return application;
}

export async function listApplicationsForDeveloper(developerId: string) {
  return prisma.application.findMany({
    where: { createdById: developerId },
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });
}

export async function getCommissionSummaryForDeveloper(developerId: string) {
  const commissions = await prisma.commission.findMany({
    where: { developerId },
    orderBy: { createdAt: "desc" },
    include: { application: true, order: true },
  });

  const pending = commissions.filter((c) => c.status === "PENDING").reduce((sum, c) => sum + Number(c.amount), 0);
  const paid = commissions.filter((c) => c.status === "PAID").reduce((sum, c) => sum + Number(c.amount), 0);

  return { commissions, pending, paid };
}
