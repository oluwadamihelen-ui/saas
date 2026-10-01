import type { Metadata } from "next";
import { Badge, Button, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";
import { prisma } from "@/lib/db";
import { getMarketSettings } from "@/lib/market/settings";
import { saveCategoryAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Settings" };

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [s, cats] = await Promise.all([getMarketSettings(), prisma.category.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }] })]);
  return (
    <>
      <PageHeader title="Platform settings" subtitle="Commission, fees, price limits and holdback. Changes apply to NEW orders only." />
      <SettingsForm s={s} />
      <Card className="mt-6">
        <CardHeader title="Categories" />
        {sp.error && <p role="alert" className="px-4 pt-3 text-sm text-down">{sp.error}</p>}
        <ul className="divide-y divide-line">{cats.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"><form action={saveCategoryAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={c.id} /><Input name="name" defaultValue={c.name} className="h-8 w-44" /><Input name="sort" defaultValue={c.sort} inputMode="numeric" className="h-8 w-16" aria-label="Sort order" /><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" name="active" defaultChecked={c.active} className="accent-blue-500" />active</label><Button size="sm" variant="secondary">Save</Button></form>{!c.active && <Badge tone="neutral">hidden</Badge>}</li>)}</ul>
        <form action={saveCategoryAction} className="flex gap-2 border-t border-line p-4"><Input name="name" placeholder="New category" className="h-9 max-w-xs" /><Button size="sm">Add</Button></form>
      </Card>
    </>
  );
}
