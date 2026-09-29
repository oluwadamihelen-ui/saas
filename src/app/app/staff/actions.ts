"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS, HOTEL_ROLE_KEYS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";
import { resetMemberPassword } from "@/lib/services/account";
import { emailUser } from "@/lib/services/notifications";
import { getHotelById } from "@/lib/services/hotels";
import type { RoleKey, StaffDepartment, EmploymentStatus } from "@/generated/prisma/enums";

const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.custom<RoleKey>((v) => typeof v === "string" && (HOTEL_ROLE_KEYS as string[]).includes(v)),
  department: z.string().optional(),
});

export interface StaffFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function createStaffMember(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const actor = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const parsed = staffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    const alreadyMember = await prisma.hotelMember.findUnique({ where: { hotelId_userId: { hotelId: actor.hotelId, userId: existing.id } } });
    if (alreadyMember) return { status: "error", message: "This person is already staff at your hotel." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = existing ?? (await prisma.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash, status: "ACTIVE" } }));

  const member = await prisma.hotelMember.create({
    data: {
      hotelId: actor.hotelId,
      userId: user.id,
      role: parsed.data.role,
      department: (parsed.data.department as StaffDepartment) || undefined,
      employmentStatus: "ACTIVE",
    },
  });

  await recordAuditLog({ hotelId: actor.hotelId, actorId: actor.id, action: "staff.created", resourceType: "HotelMember", resourceId: member.id, newValue: { email: user.email, role: member.role } });

  const hotel = await getHotelById(actor.hotelId);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await emailUser(
    { email: user.email, name: user.name },
    {
      type: "staff.welcome",
      title: `You've been added to ${hotel?.name ?? "your hotel"} on Otelum`,
      message: `An account was created for you at ${hotel?.name ?? "your hotel"} with the role of ${parsed.data.role.replaceAll("_", " ").toLowerCase()}. Sign in at ${appUrl}/login using the credentials your manager shared with you.`,
    }
  );

  revalidatePath("/app/staff");
  return { status: "success" };
}

const updateSchema = z.object({
  role: z.custom<RoleKey>((v) => typeof v === "string" && (HOTEL_ROLE_KEYS as string[]).includes(v)),
  department: z.string().optional(),
  employmentStatus: z.custom<EmploymentStatus>((v) => typeof v === "string"),
});

export async function updateStaffMember(memberId: string, formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);

  const member = await prisma.hotelMember.findFirst({ where: { id: memberId, hotelId: actor.hotelId } });
  if (!member) throw new Error("Staff member not found");

  await prisma.hotelMember.update({
    where: { id: memberId },
    data: { role: parsed.data.role, department: (parsed.data.department as StaffDepartment) || null, employmentStatus: parsed.data.employmentStatus },
  });

  await recordAuditLog({ hotelId: actor.hotelId, actorId: actor.id, action: "staff.updated", resourceType: "HotelMember", resourceId: memberId, newValue: parsed.data });
  revalidatePath("/app/staff");
  revalidatePath(`/app/staff/${memberId}`);
}

const resetPasswordSchema = z.object({ newPassword: z.string().min(8, "Password must be at least 8 characters").max(200) });

export interface ResetPasswordState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function resetStaffPasswordAction(memberId: string, _prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const actor = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  try {
    await resetMemberPassword(actor.hotelId, actor.id, memberId, parsed.data.newPassword);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to reset password." };
  }

  return { status: "success", message: "Password reset. Share the new password with them securely." };
}

export async function togglePermissionOverride(memberId: string, userId: string, permissionId: string, granted: boolean) {
  const actor = await requirePermission(PERMISSIONS.STAFF_MANAGE);

  await prisma.userPermission.upsert({
    where: { userId_hotelId_permissionId: { userId, hotelId: actor.hotelId, permissionId } },
    update: { granted },
    create: { userId, hotelId: actor.hotelId, permissionId, granted },
  });

  await recordAuditLog({ hotelId: actor.hotelId, actorId: actor.id, action: "staff.permission_updated", resourceType: "User", resourceId: userId, newValue: { permissionId, granted } });
  revalidatePath(`/app/staff/${memberId}`);
}
