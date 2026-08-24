import type { ViewingEventType } from "@cinerra/database";
import { prisma } from "./db";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("We couldn't find that project.");
  }
}

/**
 * Records a real playback milestone — first wiring of the ViewingEvent
 * model, which existed in the schema as scaffolding with nothing writing
 * to it. userId is nullable because anonymous viewing of free/public
 * content is real and must be trackable too, same null-safe pattern
 * getContentAccess already uses.
 */
export async function recordViewingEvent(params: { userId: string | null; projectId: string; episodeId: string | null; type: ViewingEventType }): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: params.projectId }, select: { id: true } });
  if (!project) throw new ProjectNotFoundError();

  await prisma.viewingEvent.create({
    data: { userId: params.userId, projectId: params.projectId, episodeId: params.episodeId, type: params.type },
  });
}

export interface EngagementAnalytics {
  totalStarts: number;
  completionRate: number; // COMPLETED / STARTED, 0 when there are no starts
  topContent: { projectId: string; projectTitle: string; starts: number }[];
}

/**
 * Deliberately does NOT include a "conversion rate" (viewer who saw a
 * paywall vs. who paid) — the watch page only ever renders a <video> for
 * content the viewer already has access to (free or already unlocked),
 * so there's no "paywall impression" event anywhere to build that funnel
 * from. What's actually measurable here is engagement with content
 * viewers can already watch: how many started, and what fraction stuck
 * around to the end.
 */
export async function getEngagementAnalytics(): Promise<EngagementAnalytics> {
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [startedCount, completedCount, topStartsRaw] = await Promise.all([
    prisma.viewingEvent.count({ where: { type: "STARTED", createdAt: { gte: windowStart } } }),
    prisma.viewingEvent.count({ where: { type: "COMPLETED", createdAt: { gte: windowStart } } }),
    prisma.viewingEvent.groupBy({
      by: ["projectId"],
      where: { type: "STARTED", createdAt: { gte: windowStart } },
      _count: true,
      orderBy: { _count: { projectId: "desc" } },
      take: 10,
    }),
  ]);

  const projectIds = topStartsRaw.map((r) => r.projectId);
  const projects = await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true } });
  const projectTitle = new Map(projects.map((p) => [p.id, p.title]));

  return {
    totalStarts: startedCount,
    completionRate: startedCount > 0 ? completedCount / startedCount : 0,
    topContent: topStartsRaw.map((r) => ({ projectId: r.projectId, projectTitle: projectTitle.get(r.projectId) ?? "Deleted project", starts: r._count })),
  };
}
