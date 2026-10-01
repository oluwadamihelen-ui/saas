import type { Metadata } from "next";
import { PageHeader, UpgradeNote, Disclaimer } from "@/components/ui";
import { getContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { DEFAULT_CHECKLIST } from "@/lib/engine/guardrail";
import { RulesForm, ChecklistForm } from "./forms";

export const metadata: Metadata = { title: "Risk Rules" };

export default async function RulesPage() {
  const { account, plan, user } = await getContext();
  const cl = await prisma.checklist.findUnique({ where: { userId: user.id } });
  const items = Array.isArray(cl?.items) ? (cl.items as string[]) : DEFAULT_CHECKLIST;
  return (
    <>
      <PageHeader title="Risk rules" subtitle={`Your personal limits for ${account.name}. RiskPilot tracks them — it can't block your broker.`} />
      {!plan.limits.advancedRules && <div className="mb-5"><UpgradeNote feature="Weekly loss limit, minimum risk/reward and custom risk levels are in Pro." /></div>}
      <RulesForm rs={account.riskSettings} advanced={plan.limits.advancedRules} />
      <h2 className="mb-3 mt-10 text-lg font-semibold">Pre-trade checklist</h2>
      <ChecklistForm items={items} />
      <div className="mt-8"><Disclaimer /></div>
    </>
  );
}
