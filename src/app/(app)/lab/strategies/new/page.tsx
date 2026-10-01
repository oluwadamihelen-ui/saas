import type { Metadata } from "next";
import { StrategyBuilder } from "@/components/lab/forms";
import { PageHeader } from "@/components/ui";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "New strategy" };

export default async function NewStrategy({ searchParams }: { searchParams: Promise<{ indicator?: string }> }) {
  const { indicator } = await searchParams;
  const user = await getUser();
  const ind = indicator ? await prisma.indicator.findFirst({ where: { id: indicator, userId: user.id }, select: { id: true, name: true, markets: true } }) : null;
  return (
    <>
      <PageHeader title={ind ? `Turn “${ind.name}” into a strategy` : "Build a strategy"} subtitle="Say exactly when to enter, exit, and where the stop and target go. Then test it." />
      <StrategyBuilder indicatorId={ind?.id} indicatorName={ind?.name} defaultName={ind ? `${ind.name} + 1% risk` : ""} defaultSymbol={ind?.markets[0]} />
    </>
  );
}
