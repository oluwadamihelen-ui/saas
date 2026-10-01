import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { priceLabel, STATUS_LABEL, STATUS_TONE } from "@/lib/market/format";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Listings" };

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];
  const ls = await prisma.listing.findMany({ where: status && valid.includes(status) ? { status: status as "DRAFT" } : {}, orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }], take: 100, select: { id: true, title: true, status: true, pricingModel: true, priceUsdCents: true, submittedAt: true, creator: { select: { displayName: true, verified: true } }, indicator: { select: { visibility: true } } } });
  return (
    <>
      <PageHeader title="Listings" />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">{[["", "All"], ...valid.map((v) => [v, STATUS_LABEL[v]])].map(([v, l]) => <Link key={v} href={v ? `/admin/listings?status=${v}` : "/admin/listings"} className={`rounded-lg border px-3 py-1.5 ${(status ?? "") === v ? "border-accent bg-accent-soft" : "border-line text-muted"}`}>{l}</Link>)}</div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Listing", "Creator", "Price", "Visibility", "Submitted", "Status"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{ls.map((l) => <tr key={l.id} className="hover:bg-surface-2/60"><td className="px-4 py-3"><Link href={`/admin/listings/${l.id}`} className="font-medium hover:underline">{l.title}</Link></td><td className="px-4 py-3 text-muted">{l.creator.displayName}{l.creator.verified ? " ✓" : ""}</td><td className="px-4 py-3">{priceLabel(l.pricingModel, l.priceUsdCents)}</td><td className="px-4 py-3 text-muted">{l.indicator.visibility.toLowerCase()}</td><td className="px-4 py-3 text-muted">{l.submittedAt ? fmtDate(l.submittedAt) : "—"}</td><td className="px-4 py-3"><Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge></td></tr>)}
          {ls.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Nothing here.</td></tr>}</tbody></table></Card>
    </>
  );
}
