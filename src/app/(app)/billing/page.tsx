import type { Metadata } from "next";
import { PageHeader, Card, Badge } from "@/components/ui";
import { PricingCards } from "@/components/pricing";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fmtDate, money } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  const { user, plan } = await getContext();
  const payments = await prisma.payment.findMany({ where: { userId: user.id, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <>
      <PageHeader title="Plan & billing" subtitle={plan.key === "PRO" ? `You are on Pro until ${fmtDate(plan.renewsAt!, user.timezone)}. Buying again extends it.` : "Upgrade when the free plan stops being enough. Prices in USD or NGN."} />
      <PricingCards mode="app" currentPlan={plan.key} />
      <p className="mt-4 text-xs text-muted">Payments are processed by a third-party provider; RiskPilot never sees your card details. Pro does not promise or guarantee any trading outcome.</p>
      {payments.length > 0 && (
        <Card className="mt-8">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">Payment history</div>
          <ul className="divide-y divide-line text-sm">{payments.map((p) => <li key={p.id} className="flex items-center justify-between px-4 py-3"><span className="text-muted">{fmtDate(p.createdAt, user.timezone)} · {p.interval === "ANNUAL" ? "Annual" : "Monthly"}</span><span className="flex items-center gap-2 num">{money(p.amount, p.currency, { decimals: p.currency === "NGN" ? 0 : 2 })}<Badge tone="up">Paid</Badge></span></li>)}</ul>
        </Card>
      )}
    </>
  );
}
