"use server";

import { z } from "zod";
import { acceptInvite } from "@/lib/services/staff";

const schema = z.object({
  token: z.string().min(1),
  // Only required for an ACCOUNT_INVITATION (no account yet) — a
  // PASSWORD_SETUP invite's account already has a name, set at creation.
  name: z.string().trim().max(120).nullish(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export interface AcceptInviteState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function acceptStaffInvite(_prev: AcceptInviteState, formData: FormData): Promise<AcceptInviteState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await acceptInvite(parsed.data.token, { name: parsed.data.name ?? undefined, password: parsed.data.password });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not accept invite." };
  }

  return { status: "success" };
}
