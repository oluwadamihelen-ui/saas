"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require";
import { customizationRequestSchema, createCustomizationRequest } from "@/lib/services/customization-requests";
import { convertQuoteToOrder } from "@/lib/services/quotes";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";
import { notifyUser } from "@/lib/services/notifications";
import { logger } from "@/lib/security/logger";

export interface RequestFormState {
  status: "idle" | "error";
  message?: string;
}

export async function submitCustomizationRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await requireUser();

  const parsed = customizationRequestSchema.safeParse({
    applicationId: formData.get("applicationId") || undefined,
    description: formData.get("description"),
    budget: formData.get("budget") || undefined,
    deadline: formData.get("deadline") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const request = await createCustomizationRequest(user.id, parsed.data);
  redirect(`/dashboard/quotes/requests/${request.id}`);
}

async function requireOwnedQuote(quoteId: string, customerId: string) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, customerId } });
  if (!quote) throw new Error("Quote not found");
  return quote;
}

/** Accepting a quote starts payment the same way any other purchase does -- creates an order and redirects to the payment provider. */
export async function acceptQuote(quoteId: string) {
  const user = await requireUser();
  await requireOwnedQuote(quoteId, user.id);

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const appOrigin = process.env.APP_URL ?? `${protocol}://${host}`;

  let authorizationUrl: string;
  try {
    const result = await convertQuoteToOrder(quoteId, user.id, appOrigin);
    if (!result.authorizationUrl) throw new Error("Payment provider did not return a checkout link.");
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    logger.error("quote.accept_failed", { quoteId, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }

  redirect(authorizationUrl);
}

export async function rejectQuote(quoteId: string) {
  const user = await requireUser();
  const quote = await requireOwnedQuote(quoteId, user.id);

  await prisma.quote.update({ where: { id: quoteId }, data: { status: "REJECTED" } });
  await prisma.customizationRequest.updateMany({ where: { quoteId }, data: { status: "DECLINED" } });

  await recordAuditLog({ actorId: user.id, action: "quote.rejected", resourceType: "Quote", resourceId: quoteId });
  await notifyUser(quote.customerId, { type: "quote.rejected", title: "Quote declined", message: `You declined quote ${quote.quoteNumber}.`, sendEmail: false });
}
