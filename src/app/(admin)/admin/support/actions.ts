"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { notifyUser } from "@/lib/services/notifications";

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export async function staffReplyToTicket(ticketId: string, formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPORT_MANAGE);
  const message = z.string().trim().min(1).max(4000).parse(formData.get("message"));
  const status = z.enum(TICKET_STATUSES).parse(formData.get("status"));

  const ticket = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });

  await prisma.supportMessage.create({
    data: { ticketId, authorId: user.id, authorType: "STAFF", message },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status, closedAt: status === "CLOSED" ? new Date() : null },
  });

  await notifyUser(ticket.customerId, {
    type: "support.ticket_updated",
    title: `Update on ticket: ${ticket.subject}`,
    message,
  });

  revalidatePath(`/admin/support/${ticketId}`);
}
