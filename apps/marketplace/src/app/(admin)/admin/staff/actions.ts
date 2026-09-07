"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { recordAuditLog } from "@/lib/security/audit";

const staffSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export interface StaffFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function createStaffMember(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const actor = await requireRole("SUPER_ADMIN");
  const parsed = staffSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { status: "error", message: "A user with this email already exists." };

  const staffRole = await prisma.role.findUniqueOrThrow({ where: { key: "STAFF" } });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const staff = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, roleId: staffRole.id, status: "ACTIVE" },
  });

  await recordAuditLog({ actorId: actor.id, action: "staff.created", resourceType: "User", resourceId: staff.id, newValue: { email: staff.email } });

  revalidatePath("/admin/staff");
  return { status: "success", message: "Staff account created." };
}

export async function togglePermissionOverride(userId: string, permissionId: string, granted: boolean) {
  const actor = await requireRole("SUPER_ADMIN");

  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId, permissionId } },
    update: { granted },
    create: { userId, permissionId, granted },
  });

  await recordAuditLog({ actorId: actor.id, action: "staff.permission_updated", resourceType: "User", resourceId: userId, newValue: { permissionId, granted } });
  revalidatePath(`/admin/staff`);
}

export async function suspendStaffMember(userId: string) {
  const actor = await requireRole("SUPER_ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  await recordAuditLog({ actorId: actor.id, action: "staff.suspended", resourceType: "User", resourceId: userId });
  revalidatePath("/admin/staff");
}

export async function reactivateStaffMember(userId: string) {
  const actor = await requireRole("SUPER_ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  await recordAuditLog({ actorId: actor.id, action: "staff.reactivated", resourceType: "User", resourceId: userId });
  revalidatePath("/admin/staff");
}
