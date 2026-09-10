"use server";

import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { confirmSubscriptionPayment } from "@/lib/billing/payment-provider";

export async function confirmMockSubscriptionPaymentAction(reference: string) {
  const user = await requirePermission(PERMISSIONS.BILLING_MANAGE);
  const invoice = await prisma.platformInvoice.findUnique({ where: { providerReference: reference } });
  if (!invoice || invoice.schoolId !== user.schoolId) throw new Error("Invoice not found.");
  await confirmSubscriptionPayment(reference);
}
