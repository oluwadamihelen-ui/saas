"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { initiateOnlinePayment, notifyBankTransfer, confirmOnlinePayment } from "@/lib/services/payments";

export interface PayActionState {
  status: "idle" | "error";
  message?: string;
}

async function currentOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function payOnlineAction(token: string, _prev: PayActionState, _formData: FormData): Promise<PayActionState> {
  let authorizationUrl: string;
  try {
    const origin = await currentOrigin();
    const result = await initiateOnlinePayment(token, `${origin}/pay/${token}/confirm`);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not start payment." };
  }
  redirect(authorizationUrl);
}

export async function notifyBankTransferAction(token: string, _prev: PayActionState, _formData: FormData): Promise<PayActionState> {
  try {
    await notifyBankTransfer(token);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not record your notice." };
  }
  redirect(`/pay/${token}`);
}

export async function confirmMockPaymentAction(reference: string) {
  await confirmOnlinePayment(reference);
}
