"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createAnnouncement, publishAnnouncement } from "@/lib/services/announcements";

const audienceEnum = z.enum(["SCHOOL_WIDE", "STAFF_ONLY", "PARENTS_ONLY", "CLASS"]);

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Message is required").max(4000),
  audience: audienceEnum,
  classArmId: z.string().trim().optional().or(z.literal("")),
  publishNow: z.string().optional(),
});

export interface AnnouncementFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createAnnouncementAction(
  _prev: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  const user = await requirePermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE);

  const parsed = schema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience"),
    classArmId: formData.get("classArmId") ?? "",
    publishNow: formData.get("publishNow") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  if (parsed.data.audience === "CLASS" && !parsed.data.classArmId) {
    return { status: "error", message: "Choose a class for a class-scoped announcement." };
  }

  await createAnnouncement(
    user.schoolId,
    user.id,
    {
      title: parsed.data.title,
      body: parsed.data.body,
      audience: parsed.data.audience,
      classArmId: parsed.data.classArmId || null,
    },
    parsed.data.publishNow === "on"
  );

  revalidatePath("/dashboard/announcements");
  return { status: "success" };
}

export async function publishAnnouncementAction(id: string) {
  const user = await requirePermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE);
  await publishAnnouncement(user.schoolId, id);
  revalidatePath("/dashboard/announcements");
}
