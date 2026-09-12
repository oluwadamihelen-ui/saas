"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";

const schema = z.object({
  dateOfBirth: z.string().optional().or(z.literal("")),
});

export interface MyProfileState {
  status: "idle" | "error" | "success";
  message?: string;
}

/// Every staff account is self-created via invite acceptance (name +
/// password only — see acceptInvite in lib/services/staff.ts), and there
/// is no admin-side staff editor yet, so date of birth is set here, by
/// the staff member themselves, the same way their name already is. This
/// is the only way a User.dateOfBirth is ever set — never entered on a
/// colleague's behalf, and never inferred or defaulted.
export async function saveMyDateOfBirth(_prev: MyProfileState, formData: FormData): Promise<MyProfileState> {
  const user = await requireSchoolUser();

  const parsed = schema.safeParse({ dateOfBirth: formData.get("dateOfBirth") ?? "" });
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid date." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/birthdays");
  return { status: "success", message: "Saved." };
}
