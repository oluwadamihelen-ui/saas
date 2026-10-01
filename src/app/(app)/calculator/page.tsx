import type { Metadata } from "next";
import Link from "next/link";
import { AppCalculator } from "@/components/calc/calculator-client";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { cn, fmtDate, money, price } from "@/lib/utils";
import { deleteCalculationAction } from "@/actions/calc";
import type { CalcInitial } from "@/components/calc/calculator";
import type { InstrumentSpec } from "@/lib/engine/risk";

export const metadata: Metadata = { title: "Calculator" };

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<{ mode?: string; reuse?: string }> }) {
  const sp = await searchParams;
  const { account, user } = await getContext();
  const mode = sp.mode === "risk" ? "risk" : "size";
  const rs = account.riskSettings;

  const history = await prisma.positionCalculation.findMany({ where: { userId: user.id, accountId: account.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const reuse = sp.reuse ? history.find((h) => h.id === sp.reuse) : undefined;
  let initial: CalcInitial = { balance: account.startingBalance, riskPercent: rs.defaultRiskPercent };
  if (reuse) {
    const i = reuse.inputs as { spec?: InstrumentSpec; fx?: number };
    initial = { symbol: reuse.instrument, balance: reuse.balance, riskPercent: reuse.riskPercent, entry: String(reuse.entryPrice), stop: String(reuse.stopLoss), tp: reuse.takeProfit ? String(reuse.takeProfit) : "", spec: i.spec, confirmed: reuse.specConfirmed, fx: i.fx };
  }
  const tabs = [{ k: "size", label: "Position size", href: "/calculator" }, { k: "risk", label: "Risk check", href: "/calculator?mode=risk" }];

  return (
    <>
      <PageHeader title="How much should I risk?" subtitle={mode === "size" ? "Enter your entry and stop loss. Get your lot size." : "Already know your lot size? See exactly how much you are risking."} />
      <div className="mb-5 inline-flex rounded-lg border border-line bg-surface p-1 text-sm">
        {tabs.map((t) => <Link key={t.k} href={t.href} className={cn("rounded-md px-4 py-1.5", mode === t.k ? "bg-accent-soft font-medium" : "text-muted")}>{t.label}</Link>)}
      </div>
      <AppCalculator key={`${mode}-${reuse?.id ?? ""}-${account.id}`} mode={mode} currency={account.currency} initial={initial} savedSpecs={account.specs} maxRiskPerTrade={rs.maxRiskPerTrade} bands={{ lowMax: rs.lowMax, moderateMax: rs.moderateMax, highMax: rs.highMax }} />

      <Card className="mt-8">
        <CardHeader title="Position size history" />
        {history.length === 0 ? <div className="p-4"><Empty title="No saved calculations" body="Press “Save calculation” after you size a trade." /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Date", "Instrument", "Entry", "Stop", "Risk", "Lots", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5 text-muted">{fmtDate(h.createdAt, user.timezone, true)}</td>
                    <td className="px-4 py-2.5 font-medium">{h.instrument}</td>
                    <td className="num px-4 py-2.5">{price(h.entryPrice)}</td>
                    <td className="num px-4 py-2.5">{price(h.stopLoss)}</td>
                    <td className="num px-4 py-2.5">{h.riskPercent}% <span className="text-muted">({money(h.riskAmount, account.currency, { decimals: 2 })})</span></td>
                    <td className="num px-4 py-2.5 font-medium">{h.lots}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Link href={`/calculator?reuse=${h.id}`} className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">Use again</Link>
                      <form action={async () => { "use server"; await deleteCalculationAction(h.id); }} className="ml-2 inline"><button className="text-xs text-muted hover:text-down">Delete</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
