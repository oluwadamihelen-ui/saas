import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { Badge, Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { EvidenceForm, ListingEditor, ScreenshotForm } from "@/components/market/creator-forms";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listCategories, submissionProblems } from "@/lib/market/listings";
import { getMarketSettings } from "@/lib/market/settings";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/market/format";
import { detachEvidenceAction, removeScreenshotAction, submitListingAction } from "@/actions/market";

export const metadata: Metadata = { title: "Manage listing" };

export default async function ListingManage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getUser();
  const l = await prisma.listing.findFirst({ where: { id, creator: { userId: user.id } }, include: { indicator: { select: { id: true, name: true, visibility: true, markets: true, timeframes: true } }, media: { orderBy: { sort: "asc" } }, evidence: { include: { run: { select: { id: true, label: true, sampleType: true, tradeCount: true, strategy: { select: { name: true } } } } } } } });
  if (!l) notFound();
  const [categories, settings, strategies, runs, problems] = await Promise.all([
    listCategories(), getMarketSettings(),
    prisma.strategy.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.backtestRun.findMany({ where: { userId: user.id, synthetic: false, kind: { in: ["SINGLE", "WALK_FORWARD"] } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, label: true, sampleType: true, tradeCount: true, strategy: { select: { name: true } } } }),
    submissionProblems(id),
  ]);
  const editable = l.status !== "SUSPENDED";
  const attached = new Set(l.evidence.map((e) => e.backtestRunId));
  return (
    <>
      <PageHeader title={l.title} subtitle={`Listing for ${l.indicator.name}`} action={<div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge><LinkButton href={`/market/${l.slug}`} variant="secondary" size="sm">Preview</LinkButton><LinkButton href={`/lab/indicators/${l.indicator.id}`} variant="secondary" size="sm">Indicator</LinkButton></div>} />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">{sp.error}</p>}
      {l.rejectionReason && (l.status === "REJECTED" || l.status === "SUSPENDED") && <p className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down"><b>{l.status === "REJECTED" ? "Rejected" : "Suspended"}:</b> {l.rejectionReason}</p>}
      {l.indicator.visibility === "PRIVATE" && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">The indicator is <b>Private</b>, so this listing can&apos;t go live. Set it to Unlisted or Public on the <Link href={`/lab/indicators/${l.indicator.id}`} className="underline">indicator page</Link>.</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>{editable ? <ListingEditor l={{ ...l, demoVideoUrl: l.demoVideoUrl }} categories={categories} strategies={strategies} settings={settings} /> : <p className="text-muted">This listing is suspended and can&apos;t be edited.</p>}</div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Before you submit" />
            <ul className="space-y-2 p-4 text-sm">{problems.length === 0 ? <li className="flex items-center gap-2 text-up"><Check size={16} /> Everything required is in place.</li> : problems.map((p) => <li key={p} className="flex items-start gap-2 text-warn"><Circle size={14} className="mt-0.5 shrink-0" />{p}</li>)}</ul>
            {(l.status === "DRAFT" || l.status === "REJECTED") && <form action={submitListingAction} className="border-t border-line p-4"><input type="hidden" name="id" value={l.id} /><Button disabled={problems.length > 0} className="w-full">Submit for review</Button><p className="mt-2 text-xs text-muted">A moderator checks the listing against the marketplace rules before it goes live.</p></form>}
            {l.status === "PENDING_REVIEW" && <p className="border-t border-line p-4 text-sm text-muted">Submitted — waiting for review.</p>}
          </Card>
          <Card>
            <CardHeader title={`Published backtests (${l.evidence.length}/6)`} hint="Shown publicly with every assumption. Only real-data tests run on the platform qualify — synthetic and imported results can't be used." />
            <div className="space-y-3 p-4">
              {l.evidence.map((e) => <div key={e.id} className="flex items-center justify-between gap-2 text-sm"><span>{e.run.strategy?.name} · {e.run.label || "backtest"} <Badge>{e.run.sampleType === "OUT_OF_SAMPLE" ? "out-of-sample" : e.run.sampleType === "IN_SAMPLE" ? "in-sample" : "full"}</Badge></span><form action={detachEvidenceAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="runId" value={e.backtestRunId} /><Button size="sm" variant="ghost">Remove</Button></form></div>)}
              <EvidenceForm id={l.id} runs={runs.filter((r) => !attached.has(r.id)).map((r) => ({ ...r, strategy: r.strategy?.name ?? "—" }))} />
            </div>
          </Card>
          <Card>
            <CardHeader title={`Screenshots (${l.media.length}/8)`} />
            <div className="space-y-3 p-4">
              {l.media.length > 0 && <div className="grid grid-cols-2 gap-2">{l.media.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-lg border border-line">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/market/media/${m.id}`} alt={m.caption || "screenshot"} className="w-full" /><form action={removeScreenshotAction} className="flex justify-between px-2 py-1 text-xs text-muted"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="mediaId" value={m.id} /><span className="truncate">{m.caption}</span><button className="hover:text-down">Remove</button></form></div>
              ))}</div>}
              <ScreenshotForm id={l.id} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
