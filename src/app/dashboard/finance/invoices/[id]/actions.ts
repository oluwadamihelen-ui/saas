"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { recordManualPayment, confirmPendingPayment, rejectPendingPayment } from "@/lib/services/payments";
import { toMinorUnits } from "@/lib/money";
import { logAudit } from "@/lib/audit";

export interface PaymentFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  method: z.enum(["MANUAL", "BANK_TRANSFER"]),
  reference: z.string().trim().max(100).optional().or(z.literal("")),
});

export async function recordPaymentAction(
  invoiceId: string,
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const user = await requirePermission(PERMISSIONS.PAYMENTS_RECORD);
  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the payment details." };

  try {
    await recordManualPayment(user.schoolId, user.id, invoiceId, {
      amountMinor: toMinorUnits(parsed.data.amount),
      method: parsed.data.method,
      reference: parsed.data.reference || undefined,
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not record payment." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "payment.recorded",
    resourceType: "Invoice",
    resourceId: invoiceId,
  });

  revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
  return { status: "success" };
}

export async function confirmPendingPaymentAction(invoiceId: string, paymentId: string) {
  const user = await requirePermission(PERMISSIONS.PAYMENTS_RECORD);
  await confirmPendingPayment(user.schoolId, paymentId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payment.confirmed", resourceType: "Payment", resourceId: paymentId });
  revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
}

export async function rejectPendingPaymentAction(invoiceId: string, paymentId: string) {
  const user = await requirePermission(PERMISSIONS.PAYMENTS_RECORD);
  await rejectPendingPayment(user.schoolId, paymentId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "payment.rejected", resourceType: "Payment", resourceId: paymentId });
  revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
}
