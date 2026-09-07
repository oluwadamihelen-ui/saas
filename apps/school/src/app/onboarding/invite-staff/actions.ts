"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import { inviteStaffMember } from "@/lib/services/staff";
import { markStaffInvitedStepDone } from "@/lib/services/school";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  roleId: z.string().trim().min(1, "Choose a role"),
});

export interface InviteStaffState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function sendStaffInvite(_prev: InviteStaffState, formData: FormData): Promise<InviteStaffState> {
  const user = await requireSchoolUser();

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

  revalidatePath("/onboarding/invite-staff");
  return { status: "success" };
}

export async function finishOnboarding() {
  const user = await requireSchoolUser();
  await markStaffInvitedStepDone(user.schoolId);
  redirect("/dashboard");
}
