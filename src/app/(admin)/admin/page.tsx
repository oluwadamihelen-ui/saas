import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { adminOverview } from "@/lib/market/admin";
import { usd } from "@/lib/market/fees";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const u = await requireAdmin();
  const o = await adminOverview({ id: u.id, role: u.role });
  return (
    <>
      <PageHeader title="Marketplace admin" subtitle="Review listings, handle reports and refunds, manage commission and payouts." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/admin/listings?status=PENDING_REVIEW"><Stat label="Awaiting review" value={o.pending} tone={o.pending ? "warn" : undefined} /></Link>
        <Stat label="Live listings" value={o.listings} /><Stat label="Creators" value={o.creators} />
        <Link href="/admin/reports"><Stat label="Open reports" value={o.openReports} tone={o.openReports ? "warn" : undefined} /></Link>
        <Stat label="Paid orders" value={o.orders} /><Stat label="Gross sales" value={usd(o.grossCents)} />
        <Stat label="Platform commission" value={usd(o.platformFeeCents)} />
        <Link href="/admin/payouts"><Stat label="Payouts to process" value={o.payoutsOpen} tone={o.payoutsOpen ? "warn" : undefined} /></Link>
      </div>
    </>
  );
}
