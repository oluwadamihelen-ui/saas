import { prisma } from "@cinerra/database";
import { checkProjectPublishEligibility } from "../lib/publishEligibility.js";
import { isPublicationPubliclyVisible } from "../lib/publicationVisibility.js";

/** Thrown when a project doesn't yet have a real finished export to publish. */
export class PublishNotEligibleError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PublishNotEligibleError";
  }
}

async function loadOwnedProjectWithExports(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { episodes: { include: { exports: { select: { kind: true, status: true } } } } },
  });
  if (!project) throw new Error("NOT_FOUND");
  if (project.ownerId !== userId) throw new Error("FORBIDDEN");
  return project;
}

/**
 * Publishing/discovery (spec's publishing phase): makes a project visible
 * in the public Discover feed. Only allowed once the project has a real
 * finished episode export — publishing must point at something that
 * actually exists, never a placeholder listing (spec §81 honesty rule).
 */
export async function publishProject(params: { userId: string; projectId: string }) {
  const project = await loadOwnedProjectWithExports(params.projectId, params.userId);

  const eligibility = checkProjectPublishEligibility(project.episodes);
  if (!eligibility.eligible) throw new PublishNotEligibleError(eligibility.reason!);

  const publication = await prisma.$transaction(async (tx) => {
    // Every (re)publish goes back into the moderation queue — a publish
    // action is never itself sufficient to appear in Discover, per the
    // moderation gate below.
    const pub = await tx.publication.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, publishedById: params.userId, visibility: "PUBLIC", moderationStatus: "PENDING" },
      update: { visibility: "PUBLIC", publishedAt: new Date(), moderationStatus: "PENDING", moderationNotes: null },
    });
    await tx.project.update({ where: { id: project.id }, data: { visibility: "PUBLIC", status: "PUBLISHED" } });
    return pub;
  });

  return publication;
}

/** Unpublishing removes the project from Discover and clears saved favorites — it does not delete the movie itself. */
export async function unpublishProject(params: { userId: string; projectId: string }): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new Error("NOT_FOUND");
  if (project.ownerId !== params.userId) throw new Error("FORBIDDEN");

  await prisma.$transaction(async (tx) => {
    await tx.publication.deleteMany({ where: { projectId: project.id } });
    await tx.project.update({ where: { id: project.id }, data: { visibility: "PRIVATE", status: "READY" } });
  });
}

/**
 * Toggles the current user's favorite/save on a published movie. Mirrors
 * the exact visibility gate the public watch page enforces (spec's
 * moderation-queue phase) — a non-owner can't favorite, and so can't
 * surface via My List, a publication they aren't allowed to view in the
 * first place (pending, rejected, or otherwise not yet public).
 */
export async function toggleFavorite(params: { userId: string; publicationId: string }): Promise<{ favorited: boolean }> {
  const publication = await prisma.publication.findUnique({
    where: { id: params.publicationId },
    include: { project: { select: { ownerId: true } } },
  });
  if (!publication) throw new Error("NOT_FOUND");
  const isOwner = publication.project.ownerId === params.userId;
  if (!isOwner && !isPublicationPubliclyVisible(publication)) throw new Error("NOT_FOUND");

  const existing = await prisma.favorite.findUnique({
    where: { userId_publicationId: { userId: params.userId, publicationId: params.publicationId } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.favorite.delete({ where: { id: existing.id } }),
      prisma.publication.update({ where: { id: params.publicationId }, data: { saves: { decrement: 1 } } }),
    ]);
    return { favorited: false };
  }

  await prisma.$transaction([
    prisma.favorite.create({ data: { userId: params.userId, publicationId: params.publicationId } }),
    prisma.publication.update({ where: { id: params.publicationId }, data: { saves: { increment: 1 } } }),
  ]);
  return { favorited: true };
}

/** Best-effort view counter for the public watch page — never blocks playback. */
export async function recordPublicationView(publicationId: string): Promise<void> {
  await prisma.publication.update({ where: { id: publicationId }, data: { views: { increment: 1 } } }).catch(() => {});
}

export type ModerationDecision = "APPROVED" | "REJECTED";

/**
 * An admin's approve/reject decision on a pending publication (the
 * Discover moderation queue) — the caller (an API route) is responsible
 * for verifying the acting user actually has the ADMIN role; this service
 * only records the decision and its audit trail.
 */
export async function reviewPublication(params: {
  moderatorUserId: string;
  publicationId: string;
  decision: ModerationDecision;
  notes?: string;
}) {
  const publication = await prisma.publication.findUnique({ where: { id: params.publicationId } });
  if (!publication) throw new Error("NOT_FOUND");

  const [updated] = await prisma.$transaction([
    prisma.publication.update({
      where: { id: params.publicationId },
      data: { moderationStatus: params.decision, moderationNotes: params.notes ?? null },
    }),
    prisma.auditLog.create({
      data: {
        userId: params.moderatorUserId,
        action: params.decision === "APPROVED" ? "PUBLICATION_APPROVED" : "PUBLICATION_REJECTED",
        entityType: "Publication",
        entityId: params.publicationId,
        metadata: params.notes ? { notes: params.notes } : undefined,
      },
    }),
  ]);

  return updated;
}
