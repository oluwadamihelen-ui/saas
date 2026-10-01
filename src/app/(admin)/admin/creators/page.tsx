import type { Metadata } from "next";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { creatorAdminAction } from "@/actions/admin";
import { payoutStatusOf } from "@/lib/market/creator";
import { decryptSecret } from "@/lib/secrets";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Creators" };

export default async function AdminCreators() {
  await requireAdmin();
  const cs = await prisma.creator.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { email: true } }, _count: { select: { listings: true, orders: true } } } });
  const op = (id: string, op: string, label: string, v: "secondary" | "danger" | "primary" = "secondary") => <form action={creatorAdminAction} className="inline"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} /><Button size="sm" variant={v}>{label}</Button></form>;
  return (
    <>
      <PageHeader title="Creators" />
      <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["Creator", "Listings", "Orders", "Payout details", "Status", ""].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{cs.map((c) => {
          const ps = payoutStatusOf(c);
          let details = "—";
          if (c.payoutMethodEnc) { try { details = decryptSecret(c.payoutMethodEnc); } catch { details = "(unreadable)"; } }
          return <tr key={c.id}><td className="px-4 py-3"><b>{c.displayName}</b> {c.verified && <Badge tone="accent">verified</Badge>}<span className="block text-xs text-muted">{c.user.email}</span></td><td className="num px-4 py-3">{c._count.listings}</td><td className="num px-4 py-3">{c._count.orders}</td>
            <td className="px-4 py-3 text-xs text-muted">{ps === "NOT_SET" ? "not set" : <><span className="text-fg">{details}</span> <Badge tone={ps === "READY" ? "up" : "warn"}>{ps === "READY" ? "verified" : "unverified"}</Badge></>}</td>
            <td className="px-4 py-3"><Badge tone={c.status === "ACTIVE" ? "up" : "down"}>{c.status.toLowerCase()}</Badge></td>
            <td className="space-x-1 px-4 py-3 text-right">{op(c.id, c.verified ? "unverify" : "verify", c.verified ? "Unverify" : "Verify")}{ps === "PENDING_VERIFICATION" && op(c.id, "verify_payout", "Verify payout", "primary")}{c.status === "ACTIVE" ? op(c.id, "suspend", "Suspend", "danger") : op(c.id, "activate", "Reinstate")}</td></tr>;
        })}</tbody></table></Card>
    </>
  );
}
