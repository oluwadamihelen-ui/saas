"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require";
import { updatePlatformSetting } from "@/lib/services/platform-settings";
import { recordAuditLog } from "@/lib/security/audit";

export interface PlatformSettingsFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function updatePlatformSettingsAction(_prev: PlatformSettingsFormState, formData: FormData): Promise<PlatformSettingsFormState> {
  const actor = await requireSuperAdmin();

  const entries: [string, string][] = [
    ["platform.supportEmail", String(formData.get("supportEmail") ?? "")],
    ["platform.trialDurationDays", String(formData.get("trialDurationDays") ?? "")],
    ["platform.defaultCurrency", String(formData.get("defaultCurrency") ?? "")],
  ];

  for (const [key, value] of entries) {
    if (value) await updatePlatformSetting(key, value);
  }

  await recordAuditLog({ hotelId: null, actorId: actor.id, action: "platform_settings.updated", resourceType: "Setting" });
  revalidatePath("/super/settings");
  return { status: "success", message: "Platform settings saved." };
}
