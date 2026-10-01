import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TradeForm } from "@/components/trade-form";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit trade" };

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  // Ownership check: the userId is part of the query, so another user's id is simply "not found".
  const t = await prisma.trade.findFirst({ where: { id, userId: ctx.user.id }, include: { tags: true } });
  if (!t) notFound();
  const s = (n: number | null) => (n === null ? "" : String(n));
  return (
    <>
      <PageHeader title="Edit trade" />
      <TradeForm
        accountId={t.accountId}
        currency={ctx.accounts.find((a) => a.id === t.accountId)?.currency ?? ctx.account.currency}
        checklist={[]}
        canScreenshots={ctx.plan.limits.screenshots}
        maxRiskPerTrade={ctx.account.riskSettings.maxRiskPerTrade}
        defaults={{
          id: t.id, openedAt: t.openedAt.toISOString(), instrument: t.instrument, direction: t.direction,
          entryPrice: String(t.entryPrice), stopLoss: String(t.stopLoss), takeProfit: s(t.takeProfit), exitPrice: s(t.exitPrice),
          lots: String(t.lots), riskAmount: String(t.riskAmount), pnl: s(t.pnl), setup: t.setup ?? "", session: t.session ?? "",
          reasonEntry: t.reasonEntry ?? "", reasonExit: t.reasonExit ?? "", emotionBefore: t.emotionBefore ?? "", emotionAfter: t.emotionAfter ?? "",
          notes: t.notes ?? "", tags: t.tags.map((x) => x.name).join(", "), checklistScore: s(t.checklistScore),
        }}
      />
    </>
  );
}
