"use server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/session";
import { PRICING, type BillingIntervalKey } from "@/config/plans";
import { getPaymentProvider } from "@/lib/payments";
import { activateFromPayment } from "@/lib/billing";
import { fulfillOrder } from "@/lib/market/orders";

export async function startCheckoutAction(fd: FormData) {
  const user = await getUser();
  const interval = String(fd.get("interval")) as BillingIntervalKey;
  const currency = String(fd.get("currency")) === "NGN" ? "NGN" : "USD";
  if (!(interval in PRICING)) redirect("/billing");

  const provider = getPaymentProvider();
  const cur = provider.currencies.includes(currency) ? currency : provider.currencies[0];
  const amount = cur === "NGN" ? PRICING[interval].ngn : PRICING[interval].usd;
  const reference = `rp_${randomUUID().replace(/-/g, "")}`;
  await prisma.payment.create({ data: { userId: user.id, provider: provider.name, reference, amount, currency: cur, interval, status: "PENDING" } });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const session = await provider.createCheckout({ reference, amount, currency: cur, email: user.email, callbackUrl: `${base}/billing/callback?reference=${reference}` });
  redirect(session.url);
}

/** Dev-only: the mock provider's "Pay" button. Refuses to run with any real provider. */
export async function mockPayAction(fd: FormData) {
  const user = await getUser();
  if (getPaymentProvider().name !== "mock") redirect("/billing");
  const reference = String(fd.get("reference") ?? "");
  if (reference.startsWith("mp_")) {
    const order = await prisma.marketOrder.findFirst({ where: { reference, buyerId: user.id } });
    if (!order) redirect("/market");
    await fulfillOrder(order.id);
    redirect(`/market/callback?reference=${reference}`);
  }
  const p = await prisma.payment.findFirst({ where: { reference, userId: user.id } });
  if (!p) redirect("/billing");
  await activateFromPayment(p.id, { authorizationCode: `mock_auth_${user.id}` });
  redirect(`/billing/callback?reference=${reference}`);
}

/** Turn automatic renewal on/off for the user's active subscription. */
export async function setAutoRenewAction(fd: FormData) {
  const user = await getUser();
  const on = String(fd.get("autoRenew")) === "on";
  await prisma.subscription.updateMany({
    where: { userId: user.id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    data: { autoRenew: on, canceledAt: on ? null : new Date() },
  });
  revalidatePath("/billing");
}
