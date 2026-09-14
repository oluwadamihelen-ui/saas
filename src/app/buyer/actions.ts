"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireBuyer, withAuthErrors } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { initializeBuyerInvoicePayment } from "@/lib/billing/payment-provider";

async function currentOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export interface BuyerFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const payBuyerInvoiceAction = withAuthErrors(async function payBuyerInvoiceAction(invoiceId: string, _prev: BuyerFormState, _formData: FormData): Promise<BuyerFormState> {
  const sessionUser = await requireBuyer();
  const buyer = await prisma.buyer.findUniqueOrThrow({ where: { userId: sessionUser.id } });

  let authorizationUrl: string;
  try {
    const origin = await currentOrigin();
    const result = await initializeBuyerInvoicePayment(buyer.id, invoiceId, sessionUser.email!, `${origin}/buyer/billing/confirm`);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not start payment." };
  }
  redirect(authorizationUrl);
});
