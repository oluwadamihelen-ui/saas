"use server";

import { requireBuyer } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { confirmBuyerInvoicePayment } from "@/lib/billing/payment-provider";

export async function confirmMockBuyerInvoicePaymentAction(reference: string) {
  const sessionUser = await requireBuyer();
  const buyer = await prisma.buyer.findUniqueOrThrow({ where: { userId: sessionUser.id } });
  const invoice = await prisma.buyerInvoice.findUnique({ where: { providerReference: reference } });
  if (!invoice || invoice.buyerId !== buyer.id) throw new Error("Invoice not found.");
  await confirmBuyerInvoicePayment(reference);
}
