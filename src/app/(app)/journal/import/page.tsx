import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/session";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import trades" };

export default async function ImportPage() {
  const { account, plan } = await getContext();
  return (
    <>
      <PageHeader title="Import trades from CSV" subtitle={`Into ${account.name}. Works with RiskPilot exports and MT5 position reports.`} action={<Link href="/journal" className="text-sm text-accent hover:underline">Back to journal</Link>} />
      <ImportForm currency={account.currency} limited={plan.limits.maxTrades !== Infinity} />
    </>
  );
}
