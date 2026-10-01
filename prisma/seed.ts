import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CHECKLIST } from "../src/lib/engine/guardrail";
import { dayKey } from "../src/lib/engine/time";

const prisma = new PrismaClient();

// Deterministic PRNG so the demo data is the same every run.
let seed = 20260901;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const INSTR = [
  { s: "XAUUSD", base: 2650, stop: 8, perLotPerPoint: 100 },
  { s: "BTCUSD", base: 62000, stop: 450, perLotPerPoint: 1 },
  { s: "EURUSD", base: 1.085, stop: 0.0018, perLotPerPoint: 100000 },
  { s: "GBPUSD", base: 1.27, stop: 0.002, perLotPerPoint: 100000 },
];
const SETUPS = ["Breakout", "Pullback", "Range", "Trend continuation", "Reversal"];
const EMO = ["Calm", "Confident", "Focused", "Anxious", "Excited", "Frustrated", "Greedy"];

async function main() {
  const email = "demo@riskpilot.app";
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({ data: { email, name: "Demo Trader", passwordHash: await bcrypt.hash("Passw0rd!", 12), onboardedAt: new Date() } });
  await prisma.checklist.create({ data: { userId: user.id, items: DEFAULT_CHECKLIST } });
  await prisma.subscription.create({ data: { userId: user.id, plan: "PRO", interval: "ANNUAL", provider: "mock", currentPeriodEnd: new Date(Date.now() + 300 * 86_400_000) } });

  const accounts: { name: string; currency: string; balance: number; broker: string; platform: string; n: number; prop?: boolean }[] = [
    { name: "Exness Demo", currency: "USD", balance: 1000, broker: "Exness", platform: "MT5", n: 70 },
    { name: "Prop Challenge (demo)", currency: "USD", balance: 10000, broker: "Demo prop firm", platform: "MT5", n: 28, prop: true },
  ];
  let activeId = "";
  for (const a of accounts) {
    const acc = await prisma.account.create({
      data: { userId: user.id, name: a.name, currency: a.currency, startingBalance: a.balance, broker: a.broker, platform: a.platform, instruments: ["XAUUSD", "BTCUSD", "EURUSD", "GBPUSD"],
        riskSettings: { create: a.prop
          ? { defaultRiskPercent: 0.5, maxRiskPerTrade: 1, maxDailyLossPercent: 5, maxWeeklyLossPercent: 8, maxTradesPerDay: 5, ruleTemplate: "two_step", maxTotalDrawdownPercent: 10, drawdownType: "STATIC", profitTargetPercent: 10 }
          : { defaultRiskPercent: 1, maxRiskPerTrade: 1, maxDailyLossPercent: 3, maxWeeklyLossPercent: 6, maxTradesPerDay: 5 } } },
    });
    if (!activeId) activeId = acc.id;
    let balance = a.balance;
    const now = new Date();
    const rows: Parameters<typeof prisma.trade.create>[0]["data"][] = [];
    for (let i = 0; i < a.n; i++) {
      // Spread over ~80 days; the last few land on "today" (UTC+1) so the dashboard guardrail has data.
      const daysAgo = i >= a.n - 3 ? 0 : Math.floor(((a.n - 3 - i) / (a.n - 3)) * 80);
      const when = new Date(now.getTime() - daysAgo * 86_400_000 - Math.floor(rnd() * 6) * 3_600_000 - (i >= a.n - 3 ? (a.n - i) * 3_600_000 : 0));
      if (when.getUTCDay() === 0 || when.getUTCDay() === 6) when.setUTCDate(when.getUTCDate() - (when.getUTCDay() === 0 ? 2 : 1));
      const inst = pick(INSTR);
      const dir = rnd() > 0.45 ? "LONG" : "SHORT";
      // Realistic imperfection: after a loss, sometimes risk a bit more.
      const prevLoss = rows.length > 0 && (rows[rows.length - 1].result === "LOSS");
      const riskPct = prevLoss && rnd() > 0.65 ? pick([2, 2.5, 3]) : pick([0.5, 1, 1, 1, 1.5]);
      const riskAmount = +(balance * riskPct / 100).toFixed(2);
      const win = rnd() < 0.46;
      const rMult = win ? +(0.8 + rnd() * 2.2).toFixed(2) : +(-(0.9 + rnd() * 0.3)).toFixed(2);
      const pnl = +(riskAmount * rMult).toFixed(2);
      const dist = inst.stop * (0.8 + rnd() * 0.5);
      const entry = +(inst.base * (1 + (rnd() - 0.5) * 0.04)).toFixed(inst.base < 10 ? 5 : 2);
      const stop = +(dir === "LONG" ? entry - dist : entry + dist).toFixed(inst.base < 10 ? 5 : 2);
      const tp = +(dir === "LONG" ? entry + dist * 2 : entry - dist * 2).toFixed(inst.base < 10 ? 5 : 2);
      const lots = +(riskAmount / (Math.abs(entry - stop) * inst.perLotPerPoint / (a.currency === "NGN" ? 1 / 1500 : 1))).toFixed(2);
      const hour = when.getUTCHours();
      const result = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
      rows.push({
        userId: user.id, accountId: acc.id, openedAt: when, instrument: inst.s, direction: dir, entryPrice: entry, stopLoss: stop, takeProfit: tp,
        exitPrice: result === "WIN" ? tp : stop, lots: Math.max(lots, 0.01), riskPercent: riskPct, riskAmount, result, pnl, rMultiple: rMult,
        setup: pick(SETUPS), session: hour >= 13 ? "New York" : hour >= 7 ? "London" : "Asia",
        reasonEntry: "Demo trade — fictional data", reasonExit: win ? "Target reached" : "Stopped out",
        emotionBefore: pick(EMO), emotionAfter: win ? pick(["Calm", "Confident", "Excited"]) : pick(["Frustrated", "Calm", "Anxious"]),
        checklistScore: rnd() > 0.3 ? pick([50, 63, 75, 88, 100]) : null,
      });
      balance += pnl;
    }
    rows.sort((x, y) => (x.openedAt as Date).getTime() - (y.openedAt as Date).getTime());
    for (const r of rows) await prisma.trade.create({ data: r });

    const byDay = new Map<string, { c: number; r: number; p: number }>();
    for (const r of rows) { const k = dayKey(r.openedAt as Date); const d = byDay.get(k) ?? { c: 0, r: 0, p: 0 }; d.c++; d.r += r.riskAmount as number; d.p += r.pnl as number; byDay.set(k, d); }
    for (const [day, d] of byDay) await prisma.dailyRisk.create({ data: { userId: user.id, accountId: acc.id, day, tradeCount: d.c, riskUsed: d.r, pnl: d.p, limitHit: -d.p >= (a.balance * 3) / 100 } });
    // Calculation history sample
    if (a.n) await prisma.positionCalculation.create({ data: { userId: user.id, accountId: acc.id, instrument: "XAUUSD", entryPrice: 2650, stopLoss: 2640, takeProfit: 2680, balance: 1000, riskPercent: 1, riskAmount: 10, lots: 0.01, lossPerLot: 1000, specConfirmed: false, inputs: { fx: 1, entry: "2650", stop: "2640", tp: "2680" } } });
  }
  await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: activeId } });
  console.log(`Seeded demo user ${email} / Passw0rd!`);
}

main().finally(() => prisma.$disconnect());
