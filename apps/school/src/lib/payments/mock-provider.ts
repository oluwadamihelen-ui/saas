import "server-only";
import { prisma } from "@/lib/db";
import type { PaymentProvider } from "./types";

/// Mimics a real gateway's redirect-then-verify flow with no external
/// credentials, so the whole online-payment journey works in local dev
/// and demos. "Initialize" points the payer at our own confirmation page
/// instead of a real checkout; "verify" reads back whatever status that
/// page already wrote to the Payment row rather than calling out anywhere.
export const mockPaymentProvider: PaymentProvider = {
  name: "mock",

  async initialize({ reference, callbackUrl }) {
    return { authorizationUrl: `${callbackUrl}?reference=${reference}` };
  },

  async verify(reference) {
    const payment = await prisma.payment.findUnique({ where: { reference } });
    if (!payment) return { status: "failed", amountMinor: 0 };
    const status = payment.status === "CONFIRMED" ? "success" : payment.status === "FAILED" ? "failed" : "pending";
    return { status, amountMinor: payment.amountMinor };
  },
};
