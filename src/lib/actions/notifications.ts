"use server";

import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/services/notifications";

export async function markNotificationReadAction(id: string) {
  const user = await requireSchoolUser();
  await markNotificationRead(user.schoolId, user.id, id);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

export async function markAllNotificationsReadAction() {
  const user = await requireSchoolUser();
  await markAllNotificationsRead(user.schoolId, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}
