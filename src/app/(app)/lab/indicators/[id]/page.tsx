import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { IndicatorMetaForm, VersionForm } from "@/components/lab/forms";
import { getUser } from "@/lib/session";
import { getOwnedIndicator, getOwnedSource } from "@/lib/lab/service";
import { deleteIndicatorAction } from "@/actions/lab";
import { createListingAction } from "@/actions/market";
import { fmtDate } from "@/lib/utils";
import type { PineInput } from "@/lib/lab/pine";

export const metadata: Metadata = { title: "Indicator" };

export default async function IndicatorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await getUser();
  const ind = await getOwnedIndicator(user.id, id); // ownership is part of the query
  if (!ind) notFound();
  const latest = ind.versions[0];
  const source = latest ? await getOwnedSource(user.id, latest.id) : null;
  const inputs = (latest?.inputs ?? []) as unknown as PineInput[];
  return (
    <>
      <PageHeader title={ind.name} subtitle={`v${ind.latestVersion} · ${ind.pineVersion ? `Pine v${ind.pineVersion} · ` : ""}by ${ind.author} · updated ${fmtDate(ind.updatedAt, user.timezone)}`}
        action={<div className="flex flex-wrap gap-2"><Badge tone={ind.visibility === "PRIVATE" ? "neutral" : "accent"}>{ind.visibility.toLowerCase()}</Badge><LinkButton href={`/lab/strategies/new?indicator=${ind.id}`} variant="secondary" size="sm">Convert to strategy</LinkButton>
          {ind.listing ? <LinkButton href={`/creator/listings/${ind.listing.id}`} size="sm">Manage listing</LinkButton> : <form action={createListingAction}><input type="hidden" name="indicatorId" value={ind.id} /><Button size="sm">Sell this indicator</Button></form>}</div>} />
      {error && <p role="alert" className="mb-4 rounded-lg bg-down-soft px-4 py-3 text-sm text-down">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <Card><CardHeader title="Details" /><div className="p-4"><IndicatorMetaForm id={ind.id} name={ind.name} description={ind.description} markets={ind.markets} timeframes={ind.timeframes} visibility={ind.visibility} /></div></Card>
          <Card>
            <CardHeader title={`Inputs (${inputs.length})`} hint={`From version ${latest?.version ?? "—"}`} />
            {inputs.length === 0 ? <p className="p-4 text-sm text-muted">No inputs recorded.</p> : (
              <table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-2 font-semibold">Variable</th><th className="px-2 py-2 font-semibold">Title</th><th className="px-2 py-2 font-semibold">Type</th><th className="px-4 py-2 font-semibold">Default</th></tr></thead>
                <tbody className="divide-y divide-line">{inputs.map((i) => <tr key={i.name}><td className="num px-4 py-2">{i.name}</td><td className="px-2 py-2">{i.title}</td><td className="px-2 py-2"><Badge>{i.type}</Badge></td><td className="num px-4 py-2">{String(i.defval ?? "—")}</td></tr>)}</tbody></table>
            )}
          </Card>
          <Card>
            <CardHeader title="Private Pine Script" hint="Only you can see this. It is never shown to buyers unless you explicitly choose “source code included” on a product." />
            {source ? <details><summary className="cursor-pointer px-4 py-3 text-sm text-muted">Show v{source.version.version} source ({source.code.length.toLocaleString()} characters)</summary><pre className="max-h-96 overflow-auto border-t border-line p-4 text-xs leading-relaxed text-muted"><code>{source.code}</code></pre></details> : <p className="p-4 text-sm text-muted">No source stored.</p>}
          </Card>
          <Card><CardHeader title="Release a new version" /><div className="p-4"><VersionForm id={ind.id} latest={ind.latestVersion} /></div></Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Version history" />
            <ul className="divide-y divide-line">{ind.versions.map((v) => (
              <li key={v.id} className="px-4 py-3 text-sm"><div className="flex justify-between"><b>v{v.version}</b><span className="text-xs text-muted">{fmtDate(v.releasedAt, user.timezone)}</span></div>{v.compatibility && <p className="text-xs text-muted">{v.compatibility}</p>}<p className="mt-1 whitespace-pre-wrap text-muted">{v.changelog}</p></li>
            ))}</ul>
          </Card>
          <Card>
            <CardHeader title="Strategies" hint="Strategies built from this indicator. Each is tested separately." action={<Link href={`/lab/strategies/new?indicator=${ind.id}`} className="text-xs text-accent hover:underline">New</Link>} />
            {ind.strategies.length === 0 ? <p className="p-4 text-sm text-muted">None yet. An indicator isn&apos;t a strategy until you define the rules.</p> : <ul className="divide-y divide-line">{ind.strategies.map((s) => <li key={s.id}><Link href={`/lab/strategies/${s.id}`} className="block px-4 py-3 text-sm hover:bg-surface-2">{s.name}</Link></li>)}</ul>}
          </Card>
          <Card className="p-4"><form action={deleteIndicatorAction}><input type="hidden" name="id" value={ind.id} /><Button variant="danger" size="sm">Delete indicator</Button></form><p className="mt-2 text-xs text-muted">Deletes the script, its versions and (if unsold) its listing.</p></Card>
        </div>
      </div>
    </>
  );
}
