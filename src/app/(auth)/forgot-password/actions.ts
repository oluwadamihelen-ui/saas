"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/password-reset";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

const emailSchema = z.string().trim().toLowerCase().email();

export interface ForgotPasswordState {
  status: "idle" | "success" | "error";
  message?: string;
}

const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_SECONDS = 15 * 60;

const GENERIC_SUCCESS_MESSAGE = "If an account exists for that email, we've sent a password reset link. It expires in 1 hour.";

export async function requestReset(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const email = parsed.data;

  const rateLimit = await checkRateLimit(`password-reset:${email}`, REQUEST_LIMIT, REQUEST_WINDOW_SECONDS);
  if (rateLimit.allowed) {
    const headerList = await headers();
    const host = headerList.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const appOrigin = process.env.APP_URL ?? `${protocol}://${host}`;

    try {
      await requestPasswordReset(email, appOrigin);
    } catch (error) {
      logger.error("password_reset.request_failed", { error: error instanceof Error ? error.message : "unknown error" });
    }
  } else {
    // Rate-limited requests still get the generic success message below --
    // returning a different response here would itself leak that this
    // specific address has been requested too many times.
    logger.warn("password_reset.rate_limited", { email });
  }

  return { status: "success", message: GENERIC_SUCCESS_MESSAGE };
}
