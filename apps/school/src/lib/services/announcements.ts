import "server-only";
import { prisma } from "@/lib/db";
import type { AnnouncementAudience, Prisma } from "@/generated/prisma/client";

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  classArmId?: string | null;
}

const ANNOUNCEMENT_PAGE_SIZE = 20;

/// Staff-side manage list — every announcement regardless of publish state,
/// newest first, so a draft is visible to the person who wrote it.
export async function listAnnouncements(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId };
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: { classArm: { include: { classGroup: true } }, createdBy: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ANNOUNCEMENT_PAGE_SIZE,
      take: ANNOUNCEMENT_PAGE_SIZE,
    }),
    prisma.announcement.count({ where }),
  ]);
  return { announcements, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / ANNOUNCEMENT_PAGE_SIZE)) };
}

/// What a staff member sees on their own dashboard: only announcements
/// meant for staff, and only once published.
export async function listAnnouncementsForStaff(schoolId: string) {
  return prisma.announcement.findMany({
    where: { schoolId, publishedAt: { not: null }, audience: { in: ["SCHOOL_WIDE", "STAFF_ONLY"] } },
    orderBy: { publishedAt: "desc" },
  });
}

export async function listAnnouncementsForGuardian(schoolId: string, guardianId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const guardian = await prisma.guardian.findFirst({
    where: { schoolId, id: guardianId },
    include: { students: { include: { student: true } } },
  });
  const classArmIds = (guardian?.students ?? [])
    .map((sg) => sg.student.classArmId)
    .filter((id): id is string => Boolean(id));

  const where: Prisma.AnnouncementWhereInput = {
    schoolId,
    publishedAt: { not: null },
    OR: [
      { audience: { in: ["SCHOOL_WIDE", "PARENTS_ONLY"] } },
      ...(classArmIds.length > 0 ? [{ audience: "CLASS" as const, classArmId: { in: classArmIds } }] : []),
    ],
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * ANNOUNCEMENT_PAGE_SIZE,
      take: ANNOUNCEMENT_PAGE_SIZE,
    }),
    prisma.announcement.count({ where }),
  ]);
  return { announcements, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / ANNOUNCEMENT_PAGE_SIZE)) };
}

export async function listAnnouncementsForStudent(schoolId: string, studentId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });

  const where: Prisma.AnnouncementWhereInput = {
    schoolId,
    publishedAt: { not: null },
    OR: [
      { audience: "SCHOOL_WIDE" },
      ...(student?.classArmId ? [{ audience: "CLASS" as const, classArmId: student.classArmId }] : []),
    ],
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * ANNOUNCEMENT_PAGE_SIZE,
      take: ANNOUNCEMENT_PAGE_SIZE,
    }),
    prisma.announcement.count({ where }),
  ]);
  return { announcements, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / ANNOUNCEMENT_PAGE_SIZE)) };
}

export async function createAnnouncement(
  schoolId: string,
  createdById: string,
  input: AnnouncementInput,
  publishNow: boolean
) {
  const announcement = await prisma.announcement.create({
    data: {
      schoolId,
      createdById,
      title: input.title,
      body: input.body,
      audience: input.audience,
      classArmId: input.audience === "CLASS" ? input.classArmId : null,
      publishedAt: publishNow ? new Date() : null,
    },
  });

  if (publishNow) await notifyAnnouncementRecipients(announcement.id);
  return announcement;
}

export async function publishAnnouncement(schoolId: string, id: string) {
  const announcement = await prisma.announcement.findFirst({ where: { schoolId, id } });
  if (!announcement) throw new Error("Announcement not found.");
  if (announcement.publishedAt) return announcement;

  const published = await prisma.announcement.update({ where: { id }, data: { publishedAt: new Date() } });
  await notifyAnnouncementRecipients(id);
  return published;
}

interface AudienceRecipients {
  staffIds: string[];
  guardianUserIds: string[];
  studentUserIds: string[];
}

async function recipientsForAudience(
  schoolId: string,
  audience: AnnouncementAudience,
  classArmId: string | null
): Promise<AudienceRecipients> {
  if (audience === "STAFF_ONLY" || audience === "SCHOOL_WIDE") {
    const staff = await prisma.user.findMany({
      where: { schoolId, role: { key: { notIn: ["PARENT", "STUDENT"] } } },
      select: { id: true },
    });
    if (audience === "STAFF_ONLY") return { staffIds: staff.map((u) => u.id), guardianUserIds: [], studentUserIds: [] };

    const [guardians, students] = await Promise.all([
      prisma.guardian.findMany({ where: { schoolId, userId: { not: null } }, select: { userId: true } }),
      prisma.student.findMany({ where: { schoolId, userId: { not: null } }, select: { userId: true } }),
    ]);
    return {
      staffIds: staff.map((u) => u.id),
      guardianUserIds: guardians.map((g) => g.userId!),
      studentUserIds: students.map((s) => s.userId!),
    };
  }

  if (audience === "PARENTS_ONLY") {
    const guardians = await prisma.guardian.findMany({ where: { schoolId, userId: { not: null } }, select: { userId: true } });
    return { staffIds: [], guardianUserIds: guardians.map((g) => g.userId!), studentUserIds: [] };
  }

  // CLASS
  if (!classArmId) return { staffIds: [], guardianUserIds: [], studentUserIds: [] };
  const students = await prisma.student.findMany({
    where: { schoolId, classArmId },
    include: { guardians: { include: { guardian: true } } },
  });
  const guardianUserIds: string[] = [];
  const studentUserIds: string[] = [];
  for (const student of students) {
    if (student.userId) studentUserIds.push(student.userId);
    for (const sg of student.guardians) {
      if (sg.guardian.userId) guardianUserIds.push(sg.guardian.userId);
    }
  }
  return { staffIds: [], guardianUserIds, studentUserIds };
}

async function notifyAnnouncementRecipients(announcementId: string) {
  const announcement = await prisma.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  const { staffIds, guardianUserIds, studentUserIds } = await recipientsForAudience(
    announcement.schoolId,
    announcement.audience,
    announcement.classArmId
  );

  const groups: { ids: string[]; link: string }[] = [
    { ids: [...new Set(staffIds)], link: "/dashboard/announcements" },
    { ids: [...new Set(guardianUserIds)], link: "/portal/parent/announcements" },
    { ids: [...new Set(studentUserIds)], link: "/portal/student/announcements" },
  ];

  const data = groups.flatMap((group) =>
    group.ids.map((userId) => ({
      schoolId: announcement.schoolId,
      userId,
      type: "ANNOUNCEMENT" as const,
      title: announcement.title,
      body: announcement.body.slice(0, 140),
      link: group.link,
    }))
  );
  if (data.length === 0) return;
  await prisma.notification.createMany({ data });
}
