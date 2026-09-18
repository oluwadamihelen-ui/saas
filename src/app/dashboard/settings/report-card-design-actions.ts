"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, withAuthErrors } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  fileToReportCardHeaderDataUrl,
  fileToReportCardWatermarkDataUrl,
  fileToReportCardSignatureDataUrl,
} from "@/lib/logo-upload";
import { logAudit } from "@/lib/audit";

export interface ReportCardDesignFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

/// One submit handles all three optional image uploads plus the footer
/// text — an admin uploading a new header rarely wants to also re-upload
/// the watermark and signature in the same visit, so a blank file input
/// simply leaves that field untouched (only footerText, always present in
/// the form, can be cleared this way).
export const saveReportCardDesignAction = withAuthErrors(async function saveReportCardDesignAction(
  _prev: ReportCardDesignFormState,
  formData: FormData
): Promise<ReportCardDesignFormState> {
  const user = await requirePermission(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

  const data: { reportCardFooterText: string | null; reportCardHeaderUrl?: string; reportCardWatermarkUrl?: string; reportCardSignatureUrl?: string } = {
    reportCardFooterText: String(formData.get("footerText") ?? "").trim() || null,
  };

  const header = formData.get("header");
  if (header instanceof File && header.size > 0) {
    try {
      data.reportCardHeaderUrl = await fileToReportCardHeaderDataUrl(header);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Could not process the header image." };
    }
  }

  const watermark = formData.get("watermark");
  if (watermark instanceof File && watermark.size > 0) {
    try {
      data.reportCardWatermarkUrl = await fileToReportCardWatermarkDataUrl(watermark);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Could not process the watermark image." };
    }
  }

  const signature = formData.get("signature");
  if (signature instanceof File && signature.size > 0) {
    try {
      data.reportCardSignatureUrl = await fileToReportCardSignatureDataUrl(signature);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Could not process the signature image." };
    }
  }

  await prisma.school.update({ where: { id: user.schoolId }, data });
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "report_card_design.updated", resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
});

async function removeReportCardAsset(field: "reportCardHeaderUrl" | "reportCardWatermarkUrl" | "reportCardSignatureUrl") {
  const user = await requirePermission(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);
  await prisma.school.update({ where: { id: user.schoolId }, data: { [field]: null } });
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: `report_card_design.${field}_removed`, resourceType: "School", resourceId: user.schoolId });
  revalidatePath("/dashboard/settings");
}

export async function removeReportCardHeaderAction() {
  await removeReportCardAsset("reportCardHeaderUrl");
}

export async function removeReportCardWatermarkAction() {
  await removeReportCardAsset("reportCardWatermarkUrl");
}

export async function removeReportCardSignatureAction() {
  await removeReportCardAsset("reportCardSignatureUrl");
}
