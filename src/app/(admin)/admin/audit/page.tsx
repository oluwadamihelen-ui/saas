import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Audit log" };

export default async function AdminAudit() {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin action, including each read of a creator's private source." />
      <Card className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr>{["When", "Actor", "Action", "Target", "Details"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{logs.map((l) => <tr key={l.id}><td className="num px-4 py-2 text-muted">{l.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td><td className="num px-4 py-2 text-xs text-muted">{l.actorId.slice(-6)}</td><td className="px-4 py-2 font-medium">{l.action}</td><td className="px-4 py-2 text-muted">{l.targetType} {l.targetId.slice(-6)}</td><td className="px-4 py-2 text-xs text-muted">{JSON.stringify(l.meta)}</td></tr>)}</tbody></table></Card>
    </>
  );
}
