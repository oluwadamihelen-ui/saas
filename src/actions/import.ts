"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getContext } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_IMPORT_BYTES, mapRows, parseCsv, type ImportOptions } from "@/lib/engine/csv-import";
import { DEFAULT_USD_RATES } from "@/lib/engine/instruments";
import { refreshDailyRisk } from "@/lib/data";
import { checkLimitAlerts } from "@/lib/notifications/alerts";

export interface ImportPreview {
  ok: boolean;
  error?: string;
  committed?: boolean;
  mapped?: string[];
  unmapped?: string[];
  total?: number;
  importable?: number;
  duplicates?: number;
  skipped?: number;
  overLimit?: number;
  estimatedRisk?: number;
  imported?: number;
  sample?: { line: number; instrument: string; direction: string; openedAt: string; entry: number; lots: number; risk: number; pnl: number | null }[];
  errors?: { line: number; error: string }[];
}

export async function importTradesAction(fd: FormData): Promise<ImportPreview> {
  const { user, account, plan } = await getContext();
  if (!rateLimit(`import:${user.id}`, 12, 10 * 60_000).ok) return { ok: false, error: "Too many imports. Try again in a few minutes." };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file." };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "File is larger than 2 MB." };
  const text = await file.text();
  if (text.includes("\u0000")) return { ok: false, error: "That doesn't look like a CSV text file." };

  const offset = Number(fd.get("utcOffsetHours") ?? 1);
  const opts: ImportOptions = {
    utcOffsetHours: Number.isFinite(offset) && Math.abs(offset) <= 14 ? offset : 1,
    dayFirst: fd.get("dayFirst") !== "no",
    includeCosts: fd.get("includeCosts") === "yes",
    accountCurrency: account.currency,
    fxRate: Number(fd.get("fxRate")) > 0 ? Number(fd.get("fxRate")) : DEFAULT_USD_RATES[account.currency] ?? 1,
  };
  const parsed = mapRows(parseCsv(text), opts);
  if (parsed.fatal) return { ok: false, error: parsed.fatal, mapped: parsed.mapped, unmapped: parsed.unmapped };

  const good = parsed.rows.filter((r) => r.trade).map((r) => r.trade!);
  const errors = parsed.rows.filter((r) => r.error).map((r) => ({ line: r.line, error: r.error! }));

  const existing = await prisma.trade.findMany({ where: { accountId: account.id, userId: user.id }, select: { externalId: true, openedAt: true, pnl: true } });
  const have = new Set(existing.map((e) => e.externalId).filter(Boolean) as string[]);
  const fresh = [];
  let duplicates = 0;
  for (const t of good) {
    if (have.has(t.externalId)) { duplicates++; continue; }
    have.add(t.externalId); // also dedupes inside the file
    fresh.push(t);
  }
  fresh.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());

  const total = await prisma.trade.count({ where: { userId: user.id } });
  const room = plan.limits.maxTrades === Infinity ? fresh.length : Math.max(0, plan.limits.maxTrades - total);
  const toImport = fresh.slice(0, room);
  const base: ImportPreview = {
    ok: true,
    mapped: parsed.mapped as string[],
    unmapped: parsed.unmapped,
    total: parsed.rows.length,
    importable: toImport.length,
    duplicates,
    skipped: errors.length,
    overLimit: fresh.length - toImport.length,
    estimatedRisk: toImport.filter((t) => t.riskEstimated).length,
    errors: errors.slice(0, 25),
    sample: toImport.slice(0, 8).map((t) => ({ line: 0, instrument: t.instrument, direction: t.direction, openedAt: t.openedAt.toISOString(), entry: t.entryPrice, lots: t.lots, risk: t.riskAmount, pnl: t.pnl })),
  };
  if (fd.get("mode") !== "commit") return base;
  if (!toImport.length) return { ...base, ok: false, error: "Nothing new to import." };

  // Running balance (existing + imported, in time order) so risk % reflects the balance at the time.
  const timeline = [
    ...existing.filter((e) => e.pnl !== null).map((e) => ({ at: e.openedAt.getTime(), pnl: e.pnl as number, id: null as string | null })),
    ...toImport.map((t) => ({ at: t.openedAt.getTime(), pnl: t.pnl ?? 0, id: t.externalId })),
  ].sort((a, b) => a.at - b.at);
  const balanceBefore = new Map<string, number>();
  let bal = account.startingBalance;
  for (const e of timeline) { if (e.id) balanceBefore.set(e.id, bal); bal += e.pnl; }

  await prisma.$transaction(
    toImport.map((t) => {
      const pnl = t.pnl;
      const b = balanceBefore.get(t.externalId) ?? account.startingBalance;
      return prisma.trade.create({
        data: {
          userId: user.id, accountId: account.id, source: "csv", externalId: t.externalId,
          openedAt: t.openedAt, instrument: t.instrument, direction: t.direction, entryPrice: t.entryPrice, stopLoss: t.stopLoss,
          takeProfit: t.takeProfit, exitPrice: t.exitPrice, lots: t.lots, riskAmount: t.riskAmount,
          riskPercent: b > 0 ? (t.riskAmount / b) * 100 : 0,
          result: pnl === null ? "OPEN" : pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN",
          pnl, rMultiple: t.rMultiple, setup: t.setup, session: t.session, notes: t.notes,
          emotionBefore: t.emotionBefore, emotionAfter: t.emotionAfter,
          tags: { connectOrCreate: t.tags.map((name) => ({ where: { userId_name: { userId: user.id, name } }, create: { userId: user.id, name } })) },
        },
      });
    }),
  );
  await refreshDailyRisk(user.id, account.id, toImport.map((t) => t.openedAt), user.timezone, account.riskSettings.maxDailyLossPercent, account.startingBalance);
  await checkLimitAlerts(user.id, account.id);
  revalidatePath("/", "layout");
  return { ...base, committed: true, imported: toImport.length };
}
