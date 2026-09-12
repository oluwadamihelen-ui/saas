"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { inviteStaffMember, convertInviteToDirect, regeneratePasswordSetupLink } from "@/lib/services/staff";

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

/// Refreshes a pending ACCOUNT_INVITATION's token/expiry in place —
/// inviteStaffMember already upserts onto the same row when the email
/// still has a PENDING invite, so calling it again with the same
/// email/role is exactly "resend."
export async function resendInviteAction(inviteId: string) {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);
  const invite = await prisma.staffInvite.findFirst({ where: { id: inviteId, schoolId: user.schoolId, status: "PENDING" } });
  if (!invite) throw new Error("This invitation is no longer pending.");
  await inviteStaffMember(user.schoolId, user.id, invite.email, invite.roleId);
  revalidatePath("/dashboard/staff");
}

const convertSchema = z.object({
  inviteId: z.string().trim().min(1),
  name: z.string().trim().min(1, "Full name is required").max(120),
});

export interface ConvertInviteState {
  status: "idle" | "error" | "success";
  message?: string;
  inviteToken?: string;
}

/// "Create account now" on a pending invitation — see
/// convertInviteToDirect in lib/services/staff.ts for how this avoids a
/// duplicate User.
export async function convertInviteAction(_prev: ConvertInviteState, formData: FormData): Promise<ConvertInviteState> {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);

  const parsed = convertSchema.safeParse({ inviteId: formData.get("inviteId"), name: formData.get("name") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  // Revalidating here (before returning) would re-render the pending-invitations
  // list with this invite's purpose already flipped to PASSWORD_SETUP — which is
  // exactly the condition that swaps this very component out of the tree, killing
  // its dialog before the admin ever sees the token. The client refreshes instead,
  // once it closes the success dialog — see ConvertInviteButton's "Done" handler.
  try {
    const { invite } = await convertInviteToDirect(user.schoolId, user.id, parsed.data.inviteId, { name: parsed.data.name });
    return { status: "success", inviteToken: invite.token };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create the account." };
  }
}

/// Regenerates the password-setup link for a staff member who was
/// created directly but hasn't set a password yet.
export async function regenerateSetupLinkAction(userId: string): Promise<{ token: string } | { error: string }> {
  const user = await requirePermission(PERMISSIONS.STAFF_INVITE);
  try {
    const invite = await regeneratePasswordSetupLink(user.schoolId, user.id, userId);
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/administration/users");
    return { token: invite.token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not regenerate the link." };
  }
}
