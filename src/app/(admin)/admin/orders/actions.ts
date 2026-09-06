"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";
import { getPaymentProvider } from "@/lib/providers/registry";

const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PROCESSING", "AWAITING_CUSTOMER", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

export async function updateOrderStatus(orderId: string, formData: FormData) {
  const user = await requirePermission(PERMISSIONS.ORDERS_MANAGE);
  const status = z.enum(ORDER_STATUSES).parse(formData.get("status"));

  const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  await prisma.order.update({ where: { id: orderId }, data: { status } });

  await recordAuditLog({
    actorId: user.id,
    action: "order.status_changed",
    resourceType: "Order",
    resourceId: orderId,
    oldValue: { status: before.status },
    newValue: { status },
  });

  revalidatePath(`/admin/orders/${orderId}`);
}

const refundSchema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(3).max(500),
});

export async function refundOrder(orderId: string, formData: FormData) {
  const user = await requirePermission(PERMISSIONS.ORDERS_MANAGE);
  const parsed = refundSchema.parse({ amount: formData.get("amount"), reason: formData.get("reason") });

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { where: { status: "PAID" } } } });
  const payment = order.payments[0];
  if (!payment) throw new Error("No paid payment found for this order");

  const provider = await getPaymentProvider();
  if (!provider.capabilities.supportsRefunds) {
    throw new Error(`${provider.label} does not support refunds. Process this refund manually with the provider.`);
  }
  const result = await provider.refundPayment({ providerReference: payment.providerRef ?? "", amount: parsed.amount, reason: parsed.reason });

  await prisma.$transaction([
    prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: parsed.amount,
        reason: parsed.reason,
        status: result.status === "PROCESSED" ? "PROCESSED" : "PENDING",
        processedById: user.id,
        providerRef: result.providerRefundReference,
      },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: parsed.amount >= Number(payment.amount) ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: parsed.amount >= Number(order.total) ? "REFUNDED" : "PARTIALLY_REFUNDED", status: parsed.amount >= Number(order.total) ? "REFUNDED" : order.status },
    }),
  ]);

  await recordAuditLog({
    actorId: user.id,
    action: "order.refunded",
    resourceType: "Order",
    resourceId: orderId,
    newValue: { amount: parsed.amount, reason: parsed.reason },
  });

  revalidatePath(`/admin/orders/${orderId}`);
}
