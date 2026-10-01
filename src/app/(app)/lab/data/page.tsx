import type { Metadata } from "next";
import { Badge, Button, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { DatasetForms } from "@/components/lab/forms";
import { getUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deleteDatasetAction } from "@/actions/lab";

export const metadata: Metadata = { title: "Candle data" };

export default async function DataPage() {
  const user = await getUser();
  const ds = await prisma.dataset.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, symbol: true, timeframe: true, source: true, candleCount: true, fromTs: true, toTs: true, originalFilename: true } });
  return (
    <>
      <PageHeader title="Candle data" subtitle="Backtests run on candles you provide. RiskPilot has no market-data feed." />
      <DatasetForms />
      <Card className="mt-6">
        <CardHeader title={`Your datasets (${ds.length})`} />
        {ds.length === 0 ? <div className="p-4"><Empty title="No datasets" body="Upload a CSV of OHLC candles to start testing." /></div> : (
          <ul className="divide-y divide-line">{ds.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span><b>{d.name}</b> <span className="text-muted">· {d.symbol} {d.timeframe} · {d.candleCount.toLocaleString()} candles · {d.fromTs.toISOString().slice(0, 10)} → {d.toTs.toISOString().slice(0, 10)}</span></span>
              <span className="flex items-center gap-2">{d.source === "SYNTHETIC" ? <Badge tone="warn">synthetic</Badge> : <Badge tone="up">uploaded</Badge>}<form action={deleteDatasetAction}><input type="hidden" name="id" value={d.id} /><Button variant="ghost" size="sm">Delete</Button></form></span>
            </li>
          ))}</ul>
        )}
      </Card>
    </>
  );
}
