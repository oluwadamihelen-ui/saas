"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { requestPasswordReset } from "@/lib/services/password-reset";
import { recordAuditLog } from "@/lib/security/audit";
import * as usersService from "@/lib/services/users";

function revalidateUserPaths(userId: string) {
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);
}

export async function promoteToDeveloper(userId: string) {
  const actor = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  await usersService.promoteToDeveloper(actor.id, userId);
  revalidateUserPaths(userId);
}

export async function revertToCustomer(userId: string) {
  const actor = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  await usersService.revertToCustomer(actor.id, userId);
  revalidateUserPaths(userId);
}

export async function suspendUser(userId: string) {
  const actor = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  await usersService.suspendPlatformUser(actor.id, userId);
  revalidateUserPaths(userId);
}

export async function reactivateUser(userId: string) {
  const actor = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  await usersService.reactivatePlatformUser(actor.id, userId);
  revalidateUserPaths(userId);
}

/**
 * A support-facing fallback alongside self-service /forgot-password --
 * covers a customer who can't complete the email flow themselves (e.g.
 * contacting support directly, or a dev environment on the mock email
 * provider). Reuses the exact same requestPasswordReset() the public flow
 * uses, so it never displays or generates a password admin-side -- only
 * ever sends the same reset-link email the customer would send themselves.
 */
export async function sendPasswordResetEmail(userId: string) {
  const actor = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const appOrigin = process.env.APP_URL ?? `${protocol}://${host}`;

  await requestPasswordReset(user.email, appOrigin);
  await recordAuditLog({ actorId: actor.id, action: "user.password_reset_email_sent", resourceType: "User", resourceId: userId });
  revalidateUserPaths(userId);
}
