import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/session";

const esc = (v: unknown) => {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const plan = await getPlan(userId);
  if (!plan.limits.exportData) return new NextResponse("Export is a Pro feature", { status: 403 });
  const trades = await prisma.trade.findMany({ where: { userId }, include: { tags: true, account: { select: { name: true } } }, orderBy: { openedAt: "asc" } });
  const head = ["date", "account", "instrument", "direction", "entry", "stop_loss", "take_profit", "exit", "lots", "risk_percent", "risk_amount", "result", "pnl", "r_multiple", "setup", "session", "emotion_before", "emotion_after", "tags", "notes"];
  const rows = trades.map((t) => [t.openedAt, t.account.name, t.instrument, t.direction, t.entryPrice, t.stopLoss, t.takeProfit, t.exitPrice, t.lots, t.riskPercent.toFixed(3), t.riskAmount, t.result, t.pnl, t.rMultiple?.toFixed(3), t.setup, t.session, t.emotionBefore, t.emotionAfter, t.tags.map((x) => x.name).join(";"), t.notes].map(esc).join(","));
  return new NextResponse([head.join(","), ...rows].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="riskpilot-trades.csv"' } });
}
