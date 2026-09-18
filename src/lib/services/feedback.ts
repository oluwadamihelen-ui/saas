import "server-only";
import { prisma } from "@/lib/db";

const FEEDBACK_PAGE_SIZE = 20;

export async function submitFeedback(schoolId: string, submittedById: string, message: string) {
  return prisma.feedback.create({ data: { schoolId, submittedById, message } });
}

/// Staff-facing: every submission across the school, newest first.
export async function listFeedback(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId };
  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: { submittedBy: { include: { role: true } }, reviewedBy: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * FEEDBACK_PAGE_SIZE,
      take: FEEDBACK_PAGE_SIZE,
    }),
    prisma.feedback.count({ where }),
  ]);
  return { items, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE)) };
}

/// Portal-facing: only what this one user submitted themselves.
export async function listMyFeedback(schoolId: string, userId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId, submittedById: userId };
  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * FEEDBACK_PAGE_SIZE,
      take: FEEDBACK_PAGE_SIZE,
    }),
    prisma.feedback.count({ where }),
  ]);
  return { items, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE)) };
}

export async function markFeedbackReviewed(schoolId: string, id: string, reviewedById: string) {
  const feedback = await prisma.feedback.findFirst({ where: { id, schoolId } });
  if (!feedback) throw new Error("Feedback not found.");
  return prisma.feedback.update({ where: { id }, data: { status: "REVIEWED", reviewedById, reviewedAt: new Date() } });
}
