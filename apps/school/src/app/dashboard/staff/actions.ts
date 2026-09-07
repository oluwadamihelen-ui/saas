"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { inviteStaffMember } from "@/lib/services/staff";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  roleId: z.string().trim().min(1, "Choose a role"),
});

export interface InviteStaffState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function sendStaffInvite(_prev: InviteStaffState, formData: FormData): Promise<InviteStaffState> {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);

  const parsed = schema.safeParse({
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await inviteStaffMember(user.schoolId, user.id, parsed.data.email, parsed.data.roleId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not send invite." };
  }

  revalidatePath("/dashboard/staff");
  return { status: "success" };
}
