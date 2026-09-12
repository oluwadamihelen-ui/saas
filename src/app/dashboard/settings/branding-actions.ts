"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { fileToLogoDataUrl } from "@/lib/logo-upload";
import { isValidHexColor } from "@/lib/color";
import { logAudit } from "@/lib/audit";

export interface BrandingFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function saveBrandingAction(_prev: BrandingFormState, formData: FormData): Promise<BrandingFormState> {
  const user = await requirePermission(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

  const colorRaw = String(formData.get("brandColor") ?? "").trim();
  if (colorRaw && !isValidHexColor(colorRaw)) {
    return { status: "error", message: "Enter a valid hex color, e.g. #1a6fba." };
  }

  const data: { brandColor: string | null; logoUrl?: string } = { brandColor: colorRaw || null };

  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    try {
      data.logoUrl = await fileToLogoDataUrl(file);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Could not process this logo." };
    }
  }

  await prisma.school.update({ where: { id: user.schoolId }, data });
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "branding.updated", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}

export async function removeLogoAction() {
  const user = await requirePermission(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);
  await prisma.school.update({ where: { id: user.schoolId }, data: { logoUrl: null } });
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "branding.logo_removed", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
}
