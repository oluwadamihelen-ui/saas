import type { Metadata } from "next";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { refundOrderAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/session";
import { usd } from "@/lib/market/fees";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Orders" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const os = await prisma.marketOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { listing: { select: { title: true } }, buyer: { select: { email: true } }, creator: { select: { displayName: true } } } });
  return (
    <>
      <PageHeader title="Orders & refunds" />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}{sp.error && <p role="alert" className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">{sp.error}</p>}
      <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Date", "Product", "Buyer", "Creator", "Gross", "Commission", "Creator share", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{os.map((o) => <tr key={o.id}><td className="px-3 py-3 text-muted">{fmtDate(o.createdAt)}</td><td className="px-3 py-3">{o.listing.title}</td><td className="px-3 py-3 text-xs text-muted">{o.buyer.email}</td><td className="px-3 py-3 text-muted">{o.creator.displayName}</td>
          <td className="num px-3 py-3">{usd(o.grossUsdCents)}</td><td className="num px-3 py-3">{usd(o.platformFeeUsdCents)} <span className="text-xs text-muted">({o.commissionPercent}%)</span></td><td className="num px-3 py-3">{usd(o.creatorEarningUsdCents)}</td>
          <td className="px-3 py-3"><Badge tone={o.status === "PAID" ? "up" : o.status === "REFUNDED" ? "down" : "neutral"}>{o.status.toLowerCase()}</Badge></td>
          <td className="px-3 py-3 text-right">{o.status === "PAID" && <form action={refundOrderAction} className="flex gap-1"><input type="hidden" name="id" value={o.id} /><Input name="reason" placeholder="Reason" className="h-8 w-32" required /><Button size="sm" variant="danger">Refund</Button></form>}</td></tr>)}
          {os.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">No orders.</td></tr>}</tbody></table></Card>
    </>
  );
}
