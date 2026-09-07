"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";

const legalSchema = z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1) });

export async function saveLegalDocument(slug: string, formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const parsed = legalSchema.parse({ title: formData.get("title"), body: formData.get("body") });

  await prisma.setting.upsert({
    where: { key: `legal.${slug}` },
    update: { value: parsed },
    create: { key: `legal.${slug}`, value: parsed },
  });

  await recordAuditLog({ actorId: user.id, action: "settings.legal_updated", resourceType: "Setting", resourceId: `legal.${slug}` });
  revalidatePath("/admin/settings");
  revalidatePath(`/legal/${slug}`);
}

const generalSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  supportEmail: z.string().trim().email(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase()),
});

export async function saveGeneralSettings(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const parsed = generalSchema.parse({
    companyName: formData.get("companyName"),
    supportEmail: formData.get("supportEmail"),
    currency: formData.get("currency"),
  });

  await prisma.setting.upsert({ where: { key: "general" }, update: { value: parsed }, create: { key: "general", value: parsed } });

  await recordAuditLog({ actorId: user.id, action: "settings.general_updated", resourceType: "Setting", resourceId: "general" });
  revalidatePath("/admin/settings");
}

const developerSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(1),
});

export async function saveDeveloperSettings(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const parsed = developerSchema.parse({ commissionRate: formData.get("commissionRate") });

  await prisma.setting.upsert({ where: { key: "developer" }, update: { value: parsed }, create: { key: "developer", value: parsed } });

  await recordAuditLog({ actorId: user.id, action: "settings.developer_updated", resourceType: "Setting", resourceId: "developer", newValue: parsed });
  revalidatePath("/admin/settings");
}
