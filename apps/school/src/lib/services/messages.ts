import "server-only";
import { prisma } from "@/lib/db";
import { notifyNewMessage } from "@/lib/services/notifications";

export async function startConversation(
  schoolId: string,
  initiatedById: string,
  input: { subject: string; body: string; studentId?: string | null }
) {
  const conversation = await prisma.conversation.create({
    data: {
      schoolId,
      initiatedById,
      subject: input.subject,
      studentId: input.studentId ?? null,
      messages: { create: { schoolId, senderId: initiatedById, body: input.body } },
    },
    include: { messages: true },
  });
  await notifyNewMessage(schoolId, conversation.id, initiatedById);
  return conversation;
}

export async function listConversationsForUser(schoolId: string, userId: string) {
  return prisma.conversation.findMany({
    where: { schoolId, initiatedById: userId },
    include: { student: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listConversationsForStaff(schoolId: string) {
  return prisma.conversation.findMany({
    where: { schoolId },
    include: {
      student: true,
      initiatedBy: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/// Returns null rather than throwing if the conversation doesn't belong to
/// this school or this user isn't the initiator and isn't staff — callers
/// (a page component) turn that into notFound() so a portal user can never
/// probe another family's thread by guessing an id.
export async function getConversationForViewer(
  schoolId: string,
  id: string,
  viewer: { userId: string; isStaff: boolean }
) {
  const conversation = await prisma.conversation.findFirst({
    where: { schoolId, id },
    include: {
      student: true,
      initiatedBy: true,
      messages: { orderBy: { createdAt: "asc" }, include: { sender: true } },
    },
  });
  if (!conversation) return null;
  if (!viewer.isStaff && conversation.initiatedById !== viewer.userId) return null;
  return conversation;
}

export async function replyToConversation(schoolId: string, senderId: string, conversationId: string, body: string) {
  const conversation = await prisma.conversation.findFirst({ where: { schoolId, id: conversationId } });
  if (!conversation) throw new Error("Conversation not found.");

  await prisma.$transaction([
    prisma.message.create({ data: { schoolId, conversationId, senderId, body } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  await notifyNewMessage(schoolId, conversationId, senderId);
}

export async function closeConversation(schoolId: string, id: string) {
  const conversation = await prisma.conversation.findFirst({ where: { schoolId, id } });
  if (!conversation) throw new Error("Conversation not found.");
  return prisma.conversation.update({ where: { id }, data: { status: "CLOSED" } });
}

export async function reopenConversation(schoolId: string, id: string) {
  const conversation = await prisma.conversation.findFirst({ where: { schoolId, id } });
  if (!conversation) throw new Error("Conversation not found.");
  return prisma.conversation.update({ where: { id }, data: { status: "OPEN" } });
}
