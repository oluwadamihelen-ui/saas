"use server";

import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/services/password-reset";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export interface ResetPasswordState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function resetPasswordAction(token: string, _prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  try {
    await resetPasswordWithToken(token, parsed.data.password);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not reset your password." };
  }

  return { status: "success" };
}
