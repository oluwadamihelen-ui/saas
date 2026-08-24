import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./index.js";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}

/**
 * The single write path for in-app notifications — mirrors an event that
 * already has a real, meaningful trigger elsewhere (an export finishing, a
 * subscription changing), never invented on its own. Best-effort by
 * convention at each call site, the same way email sends are: a failure
 * here must never affect the outcome of the real event it's describing.
 */
export async function createNotification(params: CreateNotificationParams, client: Tx = prisma) {
  return client.notification.create({
    data: { userId: params.userId, type: params.type, title: params.title, body: params.body, linkUrl: params.linkUrl },
  });
}
