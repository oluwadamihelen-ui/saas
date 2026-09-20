"use server";

import { z } from "zod";
import { acceptPortalInvite } from "@/lib/services/portal-invites";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export interface AcceptPortalInviteState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function acceptPortalInviteAction(
  _prev: AcceptPortalInviteState,
  formData: FormData,
): Promise<AcceptPortalInviteState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await acceptPortalInvite(parsed.data.token, { name: parsed.data.name, password: parsed.data.password });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not accept invite." };
  }

  return { status: "success" };
}
