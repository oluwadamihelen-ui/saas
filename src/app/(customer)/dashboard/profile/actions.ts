"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  stateProvince: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export interface ProfileState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    company: formData.get("company") || undefined,
    country: formData.get("country") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    city: formData.get("city") || undefined,
    stateProvince: formData.get("stateProvince") || undefined,
    postalCode: formData.get("postalCode") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      country: parsed.data.country || null,
      addressLine1: parsed.data.addressLine1 || null,
      city: parsed.data.city || null,
      stateProvince: parsed.data.stateProvince || null,
      postalCode: parsed.data.postalCode || null,
    },
  });

  revalidatePath("/dashboard/profile");
  return { status: "success", message: "Profile updated." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function updatePassword(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash || !(await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash))) {
    return { status: "error", message: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { status: "success", message: "Password updated." };
}
