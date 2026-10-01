import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { reportAction } from "@/actions/admin";
import { requireAdmin } from "@/lib/session";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Reports" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const rs = await prisma.report.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 100, include: { reporter: { select: { email: true } }, listing: { select: { id: true, title: true } }, review: { select: { id: true, body: true, rating: true, listing: { select: { title: true } } } } } });
  return (
    <>
      <PageHeader title="Reports" subtitle="Open reports from users." />
      {sp.ok && <p className="mb-4 rounded-xl bg-up-soft px-4 py-3 text-sm text-up">{sp.ok}</p>}{sp.error && <p role="alert" className="mb-4 rounded-xl bg-down-soft px-4 py-3 text-sm text-down">{sp.error}</p>}
      {rs.length === 0 ? <p className="text-sm text-muted">No open reports.</p> : <div className="space-y-3">{rs.map((r) => (
        <Card key={r.id} className="p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span><Badge tone="warn">{r.reason}</Badge> <span className="text-xs text-muted">{fmtDate(r.createdAt)} · by {r.reporter.email}</span></span>
            {r.listing && <Link href={`/admin/listings/${r.listing.id}`} className="text-accent hover:underline">{r.listing.title}</Link>}</div>
          {r.details && <p className="mt-2 text-muted">{r.details}</p>}
          {r.review && <p className="mt-2 rounded-lg bg-bg/60 p-3 text-muted">Review on “{r.review.listing.title}” ({r.review.rating}★): {r.review.body || "(no text)"}</p>}
          <form action={reportAction} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={r.id} /><Input name="note" placeholder="Note (optional)" className="h-9 max-w-xs" />
            <Button name="action" value="DISMISS" size="sm" variant="secondary">Dismiss</Button>{r.review && <Button name="action" value="HIDE_REVIEW" size="sm" variant="danger">Hide review</Button>}{r.listing && <Button name="action" value="SUSPEND_LISTING" size="sm" variant="danger">Suspend listing</Button>}</form>
        </Card>
      ))}</div>}
    </>
  );
}
