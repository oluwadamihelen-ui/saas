import "server-only";
import { prisma } from "@/lib/db";

export interface Actor {
  id: string;
  role: "USER" | "ADMIN";
}

export class Forbidden extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "Forbidden";
  }
}

/** Defence in depth: every admin operation checks the role itself, not just the route. */
export function assertAdmin(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor || actor.role !== "ADMIN") throw new Forbidden("Admin access required");
}

export async function audit(actor: Actor, action: string, targetType: string, targetId: string, meta: Record<string, unknown> = {}) {
  await prisma.auditLog.create({ data: { actorId: actor.id, action, targetType, targetId, meta: meta as object } });
}
