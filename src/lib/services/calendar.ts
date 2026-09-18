import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, NotifyAudience } from "@/generated/prisma/client";

const EVENT_PAGE_SIZE = 20;

/// Upcoming/current only (endAt >= now) — past events fall out of this
/// list automatically and into listArchivedCalendarEvents instead, rather
/// than needing a manual "archive" action to keep the two in sync.
export async function listCalendarEvents(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.CalendarEventWhereInput = { schoolId, endAt: { gte: new Date() } };
  const [events, total] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      include: { classArm: { include: { classGroup: true } }, term: true },
      orderBy: { startAt: "asc" },
      skip: (currentPage - 1) * EVENT_PAGE_SIZE,
      take: EVENT_PAGE_SIZE,
    }),
    prisma.calendarEvent.count({ where }),
  ]);
  return { events, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / EVENT_PAGE_SIZE)) };
}

export async function listArchivedCalendarEvents(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.CalendarEventWhereInput = { schoolId, endAt: { lt: new Date() } };
  const [events, total] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      include: { classArm: { include: { classGroup: true } }, term: true },
      orderBy: { startAt: "desc" },
      skip: (currentPage - 1) * EVENT_PAGE_SIZE,
      take: EVENT_PAGE_SIZE,
    }),
    prisma.calendarEvent.count({ where }),
  ]);
  return { events, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / EVENT_PAGE_SIZE)) };
}

export async function getCalendarEvent(schoolId: string, id: string) {
  return prisma.calendarEvent.findFirst({ where: { id, schoolId } });
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  classArmId?: string | null;
  termId?: string | null;
  notifyAudience?: NotifyAudience | null;
}

/// sessionId is derived from the chosen term rather than asked for
/// separately — a Term already belongs to exactly one AcademicSession in
/// this schema, so a second dropdown for it would just be redundant.
export async function createCalendarEvent(schoolId: string, createdById: string, input: CalendarEventInput) {
  let sessionId: string | null = null;
  if (input.termId) {
    const term = await prisma.term.findFirst({ where: { id: input.termId, schoolId } });
    if (!term) throw new Error("Select a valid term.");
    sessionId = term.academicSessionId;
  }

  return prisma.calendarEvent.create({
    data: {
      schoolId,
      createdById,
      title: input.title,
      description: input.description || null,
      startAt: input.startAt,
      endAt: input.endAt,
      classArmId: input.classArmId || null,
      termId: input.termId || null,
      sessionId,
      notifyAudience: input.notifyAudience || null,
    },
  });
}

export async function updateCalendarEvent(schoolId: string, id: string, input: CalendarEventInput) {
  const existing = await prisma.calendarEvent.findFirst({ where: { id, schoolId } });
  if (!existing) throw new Error("Event not found.");

  let sessionId: string | null = null;
  if (input.termId) {
    const term = await prisma.term.findFirst({ where: { id: input.termId, schoolId } });
    if (!term) throw new Error("Select a valid term.");
    sessionId = term.academicSessionId;
  }

  return prisma.calendarEvent.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description || null,
      startAt: input.startAt,
      endAt: input.endAt,
      classArmId: input.classArmId || null,
      termId: input.termId || null,
      sessionId,
      notifyAudience: input.notifyAudience || null,
    },
  });
}

export async function deleteCalendarEvent(schoolId: string, id: string) {
  const event = await prisma.calendarEvent.findFirst({ where: { id, schoolId } });
  if (!event) throw new Error("Event not found.");
  await prisma.calendarEvent.delete({ where: { id } });
}
