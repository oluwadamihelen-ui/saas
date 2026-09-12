"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createStaffDirect } from "@/lib/services/staff";

const schema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  roleId: z.string().trim().min(1, "Choose a role"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  staffId: z.string().trim().max(40).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE"]).optional().or(z.literal("")),
});

export interface DirectCreateState {
  status: "idle" | "error" | "success";
  message?: string;
  user?: { name: string; email: string; staffId: string | null; roleName: string; status: string };
  inviteToken?: string;
}

/// Creates the account immediately and generates its password-setup link
/// — see lib/services/staff.ts's createStaffDirect. Gated by the same
/// STAFF_INVITE permission the existing "invite via link" flow already
/// uses: both are "add a staff member" actions, just with a different
/// activation path, not two different privileges.
export async function createDirectStaffAction(_prev: DirectCreateState, formData: FormData): Promise<DirectCreateState> {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    phone: formData.get("phone") ?? "",
    staffId: formData.get("staffId") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    department: formData.get("department") ?? "",
    gender: formData.get("gender") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    const { user: created, invite } = await createStaffDirect(user.schoolId, user.id, {
      name: parsed.data.name,
      email: parsed.data.email,
      roleId: parsed.data.roleId,
      phone: parsed.data.phone || null,
      staffId: parsed.data.staffId || null,
      jobTitle: parsed.data.jobTitle || null,
      department: parsed.data.department || null,
      gender: parsed.data.gender || null,
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/administration/users");

    return {
      status: "success",
      user: { name: created.name, email: created.email, staffId: created.staffId, roleName: created.role.name, status: created.status },
      inviteToken: invite.token,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create the account." };
  }
}
