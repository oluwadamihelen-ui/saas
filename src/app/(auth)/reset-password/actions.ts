"use server";

import { z } from "zod";
import { resetPassword } from "@/lib/services/password-reset";

const schema = z.object({
  token: z.string().trim().min(1, "Missing reset token."),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export interface ResetPasswordState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function submitReset(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unable to reset password." };
  }

  return { status: "success", message: "Your password has been reset. You can now sign in." };
}
