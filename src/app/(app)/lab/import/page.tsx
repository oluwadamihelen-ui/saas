import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { TvImportForm } from "@/components/lab/forms";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Import TradingView results" };

export default async function ImportPage() {
  const user = await getUser();
  const strategies = await prisma.strategy.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
  return (<><PageHeader title="Import TradingView results" subtitle="Analyse a Strategy Tester trade list with RiskPilot's reports." /><Card className="p-4 md:p-5"><TvImportForm strategies={strategies} /></Card></>);
}
