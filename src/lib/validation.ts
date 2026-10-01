import { z } from "zod";
import { cleanText } from "@/lib/sanitize";
import { TEMPLATE_KEYS } from "@/lib/engine/challenge";

const text = (max: number) => z.string().transform((s) => cleanText(s, max));
const optText = (max: number) => z.string().optional().transform((s) => (s ? cleanText(s, max) || null : null));
const num = (msg = "Enter a number") => z.coerce.number({ error: msg }).refine(Number.isFinite, msg);
const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().refine(Number.isFinite).nullable());

export const registerSchema = z.object({
  name: text(80).pipe(z.string().min(1, "Enter your name")),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export const CURRENCY_ENUM = z.enum(["USD", "NGN", "EUR", "GBP"]);

export const accountSchema = z.object({
  name: text(60).pipe(z.string().min(1, "Give the account a name")),
  currency: CURRENCY_ENUM,
  startingBalance: num().pipe(z.number().positive("Balance must be above zero").max(1e10)),
  broker: text(60),
  platform: text(40),
  instruments: z.array(z.string().regex(/^[A-Z0-9._-]{2,20}$/)).max(30).default([]),
});

export const rulesSchema = z.object({
  defaultRiskPercent: num().pipe(z.number().gt(0).max(100)),
  maxRiskPerTrade: num().pipe(z.number().gt(0).max(100)),
  maxDailyLossPercent: num().pipe(z.number().gt(0).max(100)),
  maxWeeklyLossPercent: num().pipe(z.number().gt(0).max(100)),
  maxTradesPerDay: z.coerce.number().int().min(1).max(100),
  minRiskReward: num().pipe(z.number().min(0).max(50)),
  lowMax: num().pipe(z.number().gt(0).max(100)),
  moderateMax: num().pipe(z.number().gt(0).max(100)),
  highMax: num().pipe(z.number().gt(0).max(100)),
  maxTotalDrawdownPercent: optNum.pipe(z.number().gt(0).max(100).nullable()).default(null),
  drawdownType: z.enum(["STATIC", "TRAILING"]).default("STATIC"),
  profitTargetPercent: optNum.pipe(z.number().gt(0).max(1000).nullable()).default(null),
  ruleTemplate: z.string().optional().transform((v) => (v && TEMPLATE_KEYS.includes(v) ? v : null)),
}).refine((r) => r.lowMax < r.moderateMax && r.moderateMax < r.highMax, { message: "Risk levels must increase: low < moderate < high", path: ["lowMax"] });

export const tradeSchema = z.object({
  openedAt: z.string().min(1, "Pick a date").transform((s) => new Date(s)).refine((d) => !isNaN(d.getTime()), "Invalid date"),
  instrument: z.string().trim().toUpperCase().regex(/^[A-Z0-9._-]{2,20}$/, "Use a symbol like XAUUSD"),
  direction: z.enum(["LONG", "SHORT"]),
  entryPrice: num().pipe(z.number().positive()),
  stopLoss: num().pipe(z.number().positive()),
  takeProfit: optNum.pipe(z.number().positive().nullable()),
  exitPrice: optNum.pipe(z.number().positive().nullable()),
  lots: num().pipe(z.number().positive().max(100000)),
  riskAmount: num().pipe(z.number().positive("Enter the amount you risked")),
  pnl: optNum,
  setup: optText(60),
  session: optText(30),
  reasonEntry: optText(1000),
  reasonExit: optText(1000),
  emotionBefore: optText(30),
  emotionAfter: optText(30),
  notes: optText(4000),
  tags: z.string().optional().transform((s) => [...new Set((s ?? "").split(",").map((t) => cleanText(t, 24).toLowerCase()).filter(Boolean))].slice(0, 12)),
  checklistScore: optNum.pipe(z.number().min(0).max(100).nullable()),
}).refine((t) => t.entryPrice !== t.stopLoss, { message: "Stop loss can't equal entry", path: ["stopLoss"] })
  .refine((t) => (t.direction === "LONG" ? t.stopLoss < t.entryPrice : t.stopLoss > t.entryPrice), { message: "Stop loss is on the wrong side of entry for this direction", path: ["stopLoss"] });

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export type ActionState = { ok?: boolean; error?: string; fields?: Record<string, string>; message?: string };
