import "server-only";
import { prisma } from "@/lib/db";
import type { ClassAssessmentMode, MilestoneStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------------
// Scheme of Work: Academic Session -> Term -> Class Group -> Subject ->
// Scheme of Work -> Week/Topic -> Milestone. Feeds Pre-School Milestone
// Results (preschool-results.ts) — nothing here computes or stores an
// assessment; this is purely the curriculum plan an assessment is
// assessed against.
// ---------------------------------------------------------------------

export interface TeacherLikeUser {
  id: string;
  role: string;
}

/// A TEACHER may only touch a class+subject they're actually assigned to
/// (TeacherAssignment) — matches the milestone system's stricter teacher
/// scoping (see the note in preschool-results.ts). Any other role that
/// reached this function already cleared a school-wide permission check
/// (RESULTS_ENTER / PRESCHOOL_MILESTONES_MANAGE / RESULTS_APPROVE) at the
/// action layer, so no further narrowing applies to them here.
export async function assertClassSubjectAccess(
  schoolId: string,
  actingUser: TeacherLikeUser,
  classArmId: string,
  subjectId: string
) {
  if (actingUser.role !== "TEACHER") return;
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { schoolId, teacherId: actingUser.id, classArmId, subjectId },
  });
  if (!assignment) {
    throw new Error("You are not assigned to teach this subject in this class.");
  }
}

export async function listClassGroupsWithMode(schoolId: string) {
  return prisma.classGroup.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
}

/// Whether a class uses the numeric Grader's Results system, the
/// milestone Pre-School Results system, or both — brief section 15,
/// deliberately not inferred from the class's name (e.g. "Nursery").
export async function updateClassGroupAssessmentMode(schoolId: string, classGroupId: string, mode: ClassAssessmentMode) {
  const existing = await prisma.classGroup.findFirst({ where: { schoolId, id: classGroupId } });
  if (!existing) throw new Error("Class not found.");
  return prisma.classGroup.update({ where: { id: classGroupId }, data: { assessmentMode: mode } });
}

export async function getSchemeOfWork(schoolId: string, termId: string, classGroupId: string, subjectId: string) {
  return prisma.schemeOfWork.findUnique({
    where: { schoolId_termId_classGroupId_subjectId: { schoolId, termId, classGroupId, subjectId } },
    include: {
      topics: {
        orderBy: [{ order: "asc" }, { weekNumber: "asc" }],
        include: { milestones: { orderBy: { order: "asc" } } },
      },
      classGroup: true,
      subject: true,
      term: { include: { academicSession: true } },
    },
  });
}

export async function getOrCreateSchemeOfWork(
  schoolId: string,
  createdById: string,
  input: { academicSessionId: string; termId: string; classGroupId: string; subjectId: string }
) {
  const [session, term, classGroup, subject] = await Promise.all([
    prisma.academicSession.findFirst({ where: { schoolId, id: input.academicSessionId } }),
    prisma.term.findFirst({ where: { schoolId, id: input.termId } }),
    prisma.classGroup.findFirst({ where: { schoolId, id: input.classGroupId } }),
    prisma.subject.findFirst({ where: { schoolId, id: input.subjectId } }),
  ]);
  if (!session || !term || !classGroup || !subject) throw new Error("Select a valid session, term, class and subject.");

  return prisma.schemeOfWork.upsert({
    where: { schoolId_termId_classGroupId_subjectId: { schoolId, termId: term.id, classGroupId: classGroup.id, subjectId: subject.id } },
    create: { schoolId, academicSessionId: session.id, termId: term.id, classGroupId: classGroup.id, subjectId: subject.id, createdById },
    update: {},
  });
}

export async function addTopic(
  schoolId: string,
  schemeOfWorkId: string,
  input: { weekNumber: number; title: string; description?: string | null }
) {
  const scheme = await prisma.schemeOfWork.findFirst({ where: { schoolId, id: schemeOfWorkId } });
  if (!scheme) throw new Error("Scheme of Work not found.");

  const existing = await prisma.schemeOfWorkTopic.findFirst({ where: { schemeOfWorkId, weekNumber: input.weekNumber } });
  if (existing) throw new Error(`Week ${input.weekNumber} already has a topic ("${existing.title}").`);

  const count = await prisma.schemeOfWorkTopic.count({ where: { schemeOfWorkId } });
  return prisma.schemeOfWorkTopic.create({
    data: {
      schoolId,
      schemeOfWorkId,
      weekNumber: input.weekNumber,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      order: count,
    },
  });
}

export async function updateTopic(
  schoolId: string,
  topicId: string,
  input: { weekNumber?: number; title?: string; description?: string | null }
) {
  const existing = await prisma.schemeOfWorkTopic.findFirst({ where: { schoolId, id: topicId } });
  if (!existing) throw new Error("Topic not found.");
  return prisma.schemeOfWorkTopic.update({
    where: { id: topicId },
    data: {
      weekNumber: input.weekNumber,
      title: input.title?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
    },
  });
}

/// A topic can only be removed while it has no milestones at all — once a
/// milestone exists it must be archived (see archiveMilestone) rather than
/// deleted, so historical PreschoolMilestoneAssessment rows are never
/// orphaned.
export async function deleteTopic(schoolId: string, topicId: string) {
  const existing = await prisma.schemeOfWorkTopic.findFirst({ where: { schoolId, id: topicId }, include: { milestones: true } });
  if (!existing) throw new Error("Topic not found.");
  if (existing.milestones.length > 0) throw new Error("Remove this topic's milestones first (or archive them).");
  await prisma.schemeOfWorkTopic.delete({ where: { id: topicId } });
}

export async function addMilestone(
  schoolId: string,
  createdById: string,
  topicId: string,
  input: { title: string; description?: string | null }
) {
  const topic = await prisma.schemeOfWorkTopic.findFirst({ where: { schoolId, id: topicId } });
  if (!topic) throw new Error("Topic not found.");
  const count = await prisma.preschoolMilestone.count({ where: { topicId } });
  return prisma.preschoolMilestone.create({
    data: {
      schoolId,
      topicId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      order: count,
      createdById,
    },
  });
}

export async function updateMilestone(
  schoolId: string,
  milestoneId: string,
  input: { title?: string; description?: string | null; status?: MilestoneStatus }
) {
  const existing = await prisma.preschoolMilestone.findFirst({ where: { schoolId, id: milestoneId } });
  if (!existing) throw new Error("Milestone not found.");
  return prisma.preschoolMilestone.update({
    where: { id: milestoneId },
    data: {
      title: input.title?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      status: input.status,
    },
  });
}

/// Archiving (never deleting) keeps every already-assessed milestone
/// intact in historical reports — brief section 12. Archived milestones
/// simply stop appearing in the "assess this class" grid for new entries.
export async function archiveMilestone(schoolId: string, milestoneId: string) {
  const existing = await prisma.preschoolMilestone.findFirst({ where: { schoolId, id: milestoneId } });
  if (!existing) throw new Error("Milestone not found.");
  return prisma.preschoolMilestone.update({ where: { id: milestoneId }, data: { status: "ARCHIVED" } });
}

export async function restoreMilestone(schoolId: string, milestoneId: string) {
  const existing = await prisma.preschoolMilestone.findFirst({ where: { schoolId, id: milestoneId } });
  if (!existing) throw new Error("Milestone not found.");
  return prisma.preschoolMilestone.update({ where: { id: milestoneId }, data: { status: "ACTIVE" } });
}
