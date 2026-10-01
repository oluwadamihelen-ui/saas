import type { Metadata } from "next";
import { PageHeader, UpgradeNote, Disclaimer } from "@/components/ui";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PineGenerator } from "./pine-generator";
import { DEFAULT_PINE_PARAMS, type PineParams } from "@/lib/pine";

export const metadata: Metadata = { title: "TradingView Tools" };

export default async function TradingViewPage() {
  const { user, account, plan } = await getContext();
  if (!plan.limits.tradingViewTools) {
    return (
      <>
        <PageHeader title="TradingView Risk Tools" subtitle="Visualise entry, stop, target, risk/reward and position size right on your chart." />
        <UpgradeNote feature="The RiskPilot Risk Box Pine Script indicator is part of Pro. It draws levels you type in — it never generates buy or sell signals." />
        <div className="mt-6"><Disclaimer /></div>
      </>
    );
  }
  const saved = await prisma.pineTool.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <>
      <PageHeader title="TradingView Risk Tools" subtitle="Generate the RiskPilot Risk Box indicator pre-filled with your numbers." />
      <PineGenerator initial={{ ...DEFAULT_PINE_PARAMS, accountSize: account.startingBalance, riskPercent: account.riskSettings.defaultRiskPercent }} saved={saved.map((s) => ({ id: s.id, name: s.name, params: s.params as unknown as PineParams }))} />
    </>
  );
}
