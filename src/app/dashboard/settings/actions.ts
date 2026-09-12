"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { updateSchoolInfo } from "@/lib/services/school";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "School name is required"),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().min(1),
  currency: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  bankName: z.string().trim().max(100).optional().or(z.literal("")),
  bankAccountName: z.string().trim().max(150).optional().or(z.literal("")),
  bankAccountNumber: z.string().trim().max(30).optional().or(z.literal("")),
});

export interface SettingsState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function saveSchoolSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requirePermission(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    country: formData.get("country"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    bankName: formData.get("bankName") ?? "",
    bankAccountName: formData.get("bankAccountName") ?? "",
    bankAccountNumber: formData.get("bankAccountNumber") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  await prisma.school.update({
    where: { id: user.schoolId },
    data: {
      name: parsed.data.name,
      bankName: parsed.data.bankName || null,
      bankAccountName: parsed.data.bankAccountName || null,
      bankAccountNumber: parsed.data.bankAccountNumber || null,
    },
  });
  await updateSchoolInfo(user.schoolId, {
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    website: parsed.data.website || null,
    addressLine: parsed.data.addressLine || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
  });

  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
}
