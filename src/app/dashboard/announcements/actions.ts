"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission, withAuthErrors } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createAnnouncement, publishAnnouncement } from "@/lib/services/announcements";

const audienceEnum = z.enum(["SCHOOL_WIDE", "STAFF_ONLY", "PARENTS_ONLY", "CLASS"]);
const channelEnum = z.enum(["IN_APP", "EMAIL", "SMS", "ALL"]);

const CHANNEL_FLAGS: Record<z.infer<typeof channelEnum>, { notifyInApp: boolean; notifyEmail: boolean; notifySms: boolean }> = {
  IN_APP: { notifyInApp: true, notifyEmail: false, notifySms: false },
  EMAIL: { notifyInApp: true, notifyEmail: true, notifySms: false },
  SMS: { notifyInApp: true, notifyEmail: false, notifySms: true },
  ALL: { notifyInApp: true, notifyEmail: true, notifySms: true },
};

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Message is required").max(4000),
  audience: audienceEnum,
  classArmId: z.string().trim().optional().or(z.literal("")),
  publishNow: z.string().optional(),
  channel: channelEnum,
});

export interface AnnouncementFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const createAnnouncementAction = withAuthErrors(async function createAnnouncementAction(
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
    channel: formData.get("channel") ?? "IN_APP",
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
      ...CHANNEL_FLAGS[parsed.data.channel],
    },
    parsed.data.publishNow === "on"
  );

  revalidatePath("/dashboard/announcements");
  return { status: "success" };
});

export async function publishAnnouncementAction(id: string) {
  const user = await requirePermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE);
  await publishAnnouncement(user.schoolId, id);
  revalidatePath("/dashboard/announcements");
}
