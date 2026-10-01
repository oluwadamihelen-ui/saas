import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { TradeForm } from "@/components/trade-form";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { DEFAULT_CHECKLIST } from "@/lib/engine/guardrail";
import { guardrailFor, loadTrades } from "@/lib/data";
import { sessionFor } from "@/lib/engine/time";

export const metadata: Metadata = { title: "Record a trade" };

export default async function NewTradePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const cl = await prisma.checklist.findUnique({ where: { userId: ctx.user.id } });
  const items = Array.isArray(cl?.items) ? (cl.items as string[]) : DEFAULT_CHECKLIST;
  const trades = await loadTrades(ctx.user.id, ctx.account.id);
  const { status } = guardrailFor(ctx, trades);
  const direction = sp.entry && sp.stop ? (Number(sp.stop) < Number(sp.entry) ? "LONG" : "SHORT") : undefined;

  return (
    <>
      <PageHeader title="Record a trade" subtitle="Calculate → check → trade → journal. Fill in what you know; you can edit it later." />
      <TradeForm
        accountId={ctx.account.id}
        currency={ctx.account.currency}
        checklist={items}
        canScreenshots={ctx.plan.limits.screenshots}
        maxRiskPerTrade={ctx.account.riskSettings.maxRiskPerTrade}
        todayStatus={{ stop: status.state === "STOP" }}
        defaults={{ instrument: sp.instrument, entryPrice: sp.entry, stopLoss: sp.stop, takeProfit: sp.tp, lots: sp.lots, riskAmount: sp.riskAmount, direction, session: sessionFor(new Date()) }}
      />
    </>
  );
}
