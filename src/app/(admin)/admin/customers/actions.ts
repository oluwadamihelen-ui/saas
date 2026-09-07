"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
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
