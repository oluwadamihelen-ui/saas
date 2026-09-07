"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { generateTicketNumber } from "@/lib/utils/ids";

const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  category: z.string().trim().min(1).max(80),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  message: z.string().trim().min(5).max(4000),
});

export async function createSupportTicket(formData: FormData) {
  const user = await requireUser();
  const parsed = createTicketSchema.parse({
    subject: formData.get("subject"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    message: formData.get("message"),
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: generateTicketNumber(),
      customerId: user.id,
      subject: parsed.subject,
      category: parsed.category,
      priority: parsed.priority,
      status: "OPEN",
      messages: {
        create: { authorId: user.id, authorType: "CUSTOMER", message: parsed.message },
      },
    },
  });

  redirect(`/dashboard/support/${ticket.id}`);
}

const replySchema = z.object({ message: z.string().trim().min(1).max(4000) });

export async function replyToTicket(ticketId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = replySchema.parse({ message: formData.get("message") });

  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, customerId: user.id } });
  if (!ticket) throw new Error("Ticket not found");

  await prisma.supportMessage.create({
    data: { ticketId, authorId: user.id, authorType: "CUSTOMER", message: parsed.message },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "OPEN" : "OPEN" },
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
}
