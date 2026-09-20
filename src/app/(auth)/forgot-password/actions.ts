"use server";

import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/password-reset";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export interface ForgotPasswordState {
  status: "idle" | "error" | "success";
  message?: string;
}

/// Always returns the same success message regardless of whether the
/// email matched a real account — requestPasswordReset itself silently
/// no-ops for an unknown/inactive/portal-invite-only account, and this
/// action must never let that distinction leak back to the caller.
export async function requestPasswordResetAction(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (error) {
    console.error("requestPasswordResetAction failed", error);
    // Still a generic success — never reveal anything about what happened.
  }

  return { status: "success", message: "If that email has an account, we've sent a link to reset your password." };
}
