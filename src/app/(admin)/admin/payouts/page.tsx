import type { Metadata } from "next";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { payoutAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/session";
import { usd } from "@/lib/market/fees";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Payouts" };

export default async function AdminPayouts({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const ps = await prisma.payout.findMany({ orderBy: { requestedAt: "desc" }, take: 100, include: { creator: { select: { displayName: true, payoutMethodHint: true, payoutVerifiedAt: true } } } });
  return (
    <>
      <PageHeader title="Payouts" subtitle="Pay creators manually (bank transfer), then record the reference. Provider-based payouts can be added behind the same interface later." />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}{sp.error && <p role="alert" className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">{sp.error}</p>}
      <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Requested", "Creator", "Amount", "Account", "Status", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{ps.map((p) => <tr key={p.id}><td className="px-4 py-3 text-muted">{fmtDate(p.requestedAt)}</td><td className="px-4 py-3">{p.creator.displayName}</td><td className="num px-4 py-3 font-medium">{usd(p.amountUsdCents)}</td><td className="px-4 py-3 text-xs text-muted">{p.creator.payoutMethodHint ?? "—"} {p.creator.payoutVerifiedAt ? "" : "(unverified)"}</td><td className="px-4 py-3"><Badge tone={p.status === "PAID" ? "up" : p.status === "REQUESTED" || p.status === "PROCESSING" ? "warn" : "down"}>{p.status.toLowerCase()}</Badge>{p.reference && <span className="ml-2 text-xs text-muted">{p.reference}</span>}</td>
          <td className="px-4 py-3 text-right">{(p.status === "REQUESTED" || p.status === "PROCESSING") && <form action={payoutAction} className="flex justify-end gap-1"><input type="hidden" name="id" value={p.id} /><Input name="reference" placeholder="Transfer reference" className="h-8 w-40" /><Button name="outcome" value="PAID" size="sm">Mark paid</Button><Button name="outcome" value="FAILED" size="sm" variant="danger">Failed</Button></form>}</td></tr>)}
          {ps.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No payouts yet.</td></tr>}</tbody></table></Card>
    </>
  );
}
