"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  saveNotificationProviderCredential,
  removeNotificationProviderCredential,
  setActiveEmailProvider,
  setActiveSmsProvider,
} from "@/lib/services/notification-delivery";
import { logAudit } from "@/lib/audit";
import type { NotificationDeliveryProvider } from "@/generated/prisma/client";

export interface NotificationProviderFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const providerEnum = z.enum(["RESEND", "TWILIO", "SENTDM"]);

const saveSchema = z.object({
  provider: providerEnum,
  fromIdentifier: z.string().trim().min(1, "Enter the sender email/phone number"),
  apiKey: z.string().trim().optional().or(z.literal("")),
  accountSid: z.string().trim().optional().or(z.literal("")),
  isEnabled: z.literal("on").optional(),
});

export async function saveNotificationProviderCredentialAction(
  _prev: NotificationProviderFormState,
  formData: FormData
): Promise<NotificationProviderFormState> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_PROVIDERS_MANAGE);
  const parsed = saveSchema.safeParse({
    provider: formData.get("provider"),
    fromIdentifier: formData.get("fromIdentifier"),
    apiKey: formData.get("apiKey") ?? "",
    accountSid: formData.get("accountSid") ?? "",
    isEnabled: formData.get("isEnabled") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  try {
    await saveNotificationProviderCredential(user.schoolId, {
      provider: parsed.data.provider,
      fromIdentifier: parsed.data.fromIdentifier,
      apiKey: parsed.data.apiKey || undefined,
      accountSid: parsed.data.accountSid || undefined,
      isEnabled: parsed.data.isEnabled === "on",
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save this provider." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "notification_provider.saved", resourceType: "NotificationProviderCredential" });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}

export async function removeNotificationProviderCredentialAction(provider: NotificationDeliveryProvider) {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_PROVIDERS_MANAGE);
  await removeNotificationProviderCredential(user.schoolId, provider);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "notification_provider.removed", resourceType: "NotificationProviderCredential" });
  revalidatePath("/dashboard/settings");
}

const activeSchema = z.object({ activeProvider: z.enum(["RESEND", "TWILIO", "SENTDM", ""]) });

export async function setActiveEmailProviderAction(
  _prev: NotificationProviderFormState,
  formData: FormData
): Promise<NotificationProviderFormState> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_PROVIDERS_MANAGE);
  const parsed = activeSchema.safeParse({ activeProvider: formData.get("activeProvider") ?? "" });
  if (!parsed.success) return { status: "error", message: "Please check your details." };

  try {
    await setActiveEmailProvider(user.schoolId, parsed.data.activeProvider || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update the active email provider." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "notification_provider.email_activated", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}

export async function setActiveSmsProviderAction(
  _prev: NotificationProviderFormState,
  formData: FormData
): Promise<NotificationProviderFormState> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_PROVIDERS_MANAGE);
  const parsed = activeSchema.safeParse({ activeProvider: formData.get("activeProvider") ?? "" });
  if (!parsed.success) return { status: "error", message: "Please check your details." };

  try {
    await setActiveSmsProvider(user.schoolId, parsed.data.activeProvider || null);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update the active SMS provider." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "notification_provider.sms_activated", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}
