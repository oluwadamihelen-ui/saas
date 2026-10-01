import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, UpgradeNote } from "@/components/ui";
import { RunForm } from "@/components/lab/forms";
import { getUser } from "@/lib/session";
import { loadPlan } from "@/lib/plan";
import { getOwnedStrategy } from "@/lib/lab/service";
import { parseStrategyDef } from "@/lib/lab/schemas";
import { datasetsLite, overridesFrom, paramList } from "@/lib/lab/view";

export const metadata: Metadata = { title: "Parameter test" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getUser();
  const s = await getOwnedStrategy(user.id, id);
  if (!s) notFound();
  const def = parseStrategyDef(s.definition);
  if (!def.ok) return <p className="text-down">{def.error}</p>;
  const plan = await loadPlan(user.id);
  const gated = !plan.limits.lab.optimization;
  return (
    <>
      <PageHeader title="Parameter test" subtitle={`${s.name} · Run many parameter combinations and compare their historical statistics side by side.`} />
      {gated ? <UpgradeNote feature="Parameter tests and walk-forward testing are part of Pro." /> : <RunForm strategyId={id} datasets={await datasetsLite(user.id)} params={paramList(def.def, overridesFrom(sp))} mode="optimize" />}
    </>
  );
}
