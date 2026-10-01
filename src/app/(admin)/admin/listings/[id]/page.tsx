import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { Badge, Button, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { EvidenceCard } from "@/components/market/evidence";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getListingPage, submissionProblems } from "@/lib/market/listings";
import { getSourceForAdminReview } from "@/lib/market/access";
import { checkMarketingClaims } from "@/lib/market/claims";
import { priceLabel, STATUS_LABEL, STATUS_TONE } from "@/lib/market/format";
import { reviewListingAction } from "@/actions/admin";

export const metadata: Metadata = { title: "Admin · Review listing" };

export default async function AdminListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; source?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const admin = await requireAdmin();
  const row = await prisma.listing.findUnique({ where: { id }, select: { slug: true } });
  if (!row) notFound();
  const l = await getListingPage(row.slug, { id: admin.id, role: "ADMIN" });
  if (!l) notFound();
  const problems = await submissionProblems(id);
  const claims = checkMarketingClaims(l.title, l.tagline, l.description, ...l.features, l.documentation, l.methodology, l.dataSourceNote);
  const source = sp.source === "1" ? await getSourceForAdminReview({ id: admin.id, role: admin.role }, id) : null; // audited read
  return (
    <>
      <PageHeader title={l.title} subtitle={`${l.creator.displayName}${l.creator.verified ? " (verified)" : ""} · ${priceLabel(l.pricingModel, l.priceUsdCents)}`} action={<Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>} />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">{sp.error}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <Card><CardHeader title="Listing" /><div className="space-y-3 p-4 text-sm"><p className="text-muted">{l.tagline}</p><p className="whitespace-pre-wrap">{l.description}</p><p className="text-xs text-muted">Markets: {l.indicator.markets.join(", ")} · Timeframes: {l.indicator.timeframes.join(", ")} · Categories: {l.categories.join(", ")} · Visibility: {l.indicator.visibility.toLowerCase()} · {l.sourceIncluded ? "Source included" : "Protected"}</p><details><summary className="cursor-pointer text-accent">Documentation</summary><p className="mt-2 whitespace-pre-wrap text-muted">{l.documentation}</p></details><details><summary className="cursor-pointer text-accent">Methodology & data</summary><p className="mt-2 whitespace-pre-wrap text-muted">{l.methodology}{"\n\n"}{l.dataSourceNote}</p></details></div></Card>
          {l.evidence.map((e) => <EvidenceCard key={e.id} e={e} />)}
          <Card><CardHeader title="Source code (audited)" hint="Reading a creator's private source is logged with your admin id." />
            <div className="p-4 text-sm">{source ? <pre className="max-h-96 overflow-auto text-xs text-muted"><code>{source.code}</code></pre> : <Link href={`/admin/listings/${id}?source=1`} className="text-accent hover:underline">View latest source (this access will be logged)</Link>}</div></Card>
        </div>
        <div className="space-y-5">
          <Card><CardHeader title="Automated checks" />
            <ul className="space-y-2 p-4 text-sm">
              <li className={`flex items-start gap-2 ${claims.ok ? "text-up" : "text-down"}`}>{claims.ok ? <Check size={16} /> : <Circle size={14} className="mt-0.5" />}{claims.ok ? "No prohibited claims found" : `Prohibited claims: ${claims.matches.join(", ")}`}</li>
              {problems.length === 0 ? <li className="flex items-center gap-2 text-up"><Check size={16} /> Submission requirements met</li> : problems.map((p) => <li key={p} className="flex items-start gap-2 text-warn"><Circle size={14} className="mt-0.5 shrink-0" />{p}</li>)}
              <li className="text-xs text-muted">Automated checks are a first filter. Read the listing yourself.</li>
            </ul></Card>
          <Card><CardHeader title="Decision" />
            <div className="space-y-4 p-4">
              {[["APPROVE", "Approve", l.status === "PENDING_REVIEW", false], ["REJECT", "Reject", l.status === "PENDING_REVIEW", true], ["SUSPEND", "Suspend", l.status === "APPROVED", true], ["UNSUSPEND", "Lift suspension", l.status === "SUSPENDED", false]].filter(([, , show]) => show).map(([d, label, , needsReason]) => (
                <form key={d as string} action={reviewListingAction} className="space-y-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value={d as string} />{needsReason && <Input name="reason" placeholder="Reason shown to the creator" required minLength={10} />}<Button variant={d === "APPROVE" || d === "UNSUSPEND" ? "primary" : "danger"} size="sm">{label as string}</Button></form>
              ))}
              {!["PENDING_REVIEW", "APPROVED", "SUSPENDED"].includes(l.status) && <p className="text-sm text-muted">No decision needed in this state.</p>}
            </div></Card>
          <Link href={`/market/${l.slug}`} className="text-sm text-accent hover:underline">Open public page →</Link>
        </div>
      </div>
    </>
  );
}
