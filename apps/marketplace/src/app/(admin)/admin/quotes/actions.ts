"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createQuoteSchema, createQuote } from "@/lib/services/quotes";
import { declineRequest, markRequestUnderReview } from "@/lib/services/customization-requests";

export interface QuoteFormState {
  status: "idle" | "error";
  message?: string;
}

export async function createQuoteAdmin(requestId: string, _prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const admin = await requirePermission(PERMISSIONS.QUOTES_MANAGE);

  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");

  const items = descriptions
    .map((description, i) => ({ description: String(description), quantity: quantities[i], unitPrice: unitPrices[i] }))
    .filter((item) => item.description.trim().length > 0);

  const parsed = createQuoteSchema.safeParse({
    requestId,
    items,
    taxRate: formData.get("taxRate") || 0,
    expiresInDays: formData.get("expiresInDays") || 14,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the quote fields." };
  }

  const quote = await createQuote(admin.id, parsed.data);
  redirect(`/admin/quotes/${quote.id}`);
}

export async function markUnderReviewAdmin(requestId: string) {
  const admin = await requirePermission(PERMISSIONS.QUOTES_MANAGE);
  await markRequestUnderReview(requestId, admin.id);
  revalidatePath(`/admin/quotes/requests/${requestId}`);
}

export async function declineRequestAdmin(requestId: string) {
  const admin = await requirePermission(PERMISSIONS.QUOTES_MANAGE);
  await declineRequest(requestId, admin.id);
  revalidatePath(`/admin/quotes/requests/${requestId}`);
}
