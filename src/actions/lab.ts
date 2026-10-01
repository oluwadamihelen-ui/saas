"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { parseValues } from "@/lib/lab/optimize";
import type { ActionState } from "@/lib/validation";
import {
  addVersion, createDatasetFromCsv, createIndicator, createSyntheticDataset, deleteIndicator, deleteRun, importTradingViewResults,
  runAndSaveBacktest, runAndSaveOptimization, runAndSaveWalkForward, saveStrategy, updateIndicatorMeta, type RunInput,
} from "@/lib/lab/service";
import { prisma } from "@/lib/db";
import { MAX_CANDLE_FILE_BYTES } from "@/lib/lab/candles";
import type { PineInput } from "@/lib/lab/pine";

const vis = z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]);
const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const err = (error: string): ActionState => ({ error });

export async function createIndicatorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const visibility = vis.safeParse(fd.get("visibility"));
  if (!visibility.success) return err("Choose a visibility.");
  let inputs: PineInput[] | undefined;
  try { const raw = String(fd.get("inputs") ?? ""); inputs = raw ? (JSON.parse(raw) as PineInput[]) : undefined; } catch { return err("The inputs list couldn't be read."); }
  const r = await createIndicator(user.id, user.name ?? user.email.split("@")[0], {
    name: String(fd.get("name") ?? ""), description: String(fd.get("description") ?? ""), markets: list(fd.get("markets")), timeframes: list(fd.get("timeframes")),
    visibility: visibility.data, source: String(fd.get("source") ?? ""), version: String(fd.get("version") ?? "1.0"), inputs,
  });
  if (!r.ok) return err(r.error);
  revalidatePath("/lab");
  redirect(`/lab/indicators/${r.id}`);
}

export async function updateIndicatorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const visibility = vis.safeParse(fd.get("visibility"));
  if (!visibility.success) return err("Choose a visibility.");
  const r = await updateIndicatorMeta(user.id, String(fd.get("id")), { name: String(fd.get("name") ?? ""), description: String(fd.get("description") ?? ""), markets: list(fd.get("markets")), timeframes: list(fd.get("timeframes")), visibility: visibility.data });
  if (!r.ok) return err(r.error);
  revalidatePath(`/lab/indicators/${fd.get("id")}`);
  return { ok: true, message: "Saved." };
}

export async function addVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await addVersion(user.id, String(fd.get("id")), { version: String(fd.get("version") ?? ""), changelog: String(fd.get("changelog") ?? ""), compatibility: String(fd.get("compatibility") ?? ""), source: String(fd.get("source") ?? "") });
  if (!r.ok) return err(r.error);
  revalidatePath(`/lab/indicators/${fd.get("id")}`);
  return { ok: true, message: `Version ${fd.get("version")} released.` };
}

export async function deleteIndicatorAction(fd: FormData) {
  const user = await getUser();
  const r = await deleteIndicator(user.id, String(fd.get("id")));
  if (!r.ok) redirect(`/lab/indicators/${fd.get("id")}?error=${encodeURIComponent(r.error)}`);
  revalidatePath("/lab");
  redirect("/lab");
}

export async function saveStrategyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  let definition: unknown;
  try { definition = JSON.parse(String(fd.get("definition") ?? "")); } catch { return err("The rules couldn't be read."); }
  const r = await saveStrategy(user.id, { id: String(fd.get("id") ?? "") || undefined, name: String(fd.get("name") ?? ""), description: String(fd.get("description") ?? ""), symbol: String(fd.get("symbol") ?? "XAUUSD"), indicatorId: String(fd.get("indicatorId") ?? "") || null, definition });
  if (!r.ok) return err(r.error);
  revalidatePath("/lab");
  redirect(`/lab/strategies/${r.id}`);
}

export async function createDatasetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!rateLimit(`dataset:${user.id}`, 10, 10 * 60_000).ok) return err("Too many uploads. Try again shortly.");
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return err("Choose a CSV file.");
  if (file.size > MAX_CANDLE_FILE_BYTES) return err("File is larger than 6 MB.");
  const text = await file.text();
  if (text.includes("\u0000")) return err("That doesn't look like a CSV text file.");
  const r = await createDatasetFromCsv(user.id, { name: String(fd.get("name") ?? ""), symbol: String(fd.get("symbol") ?? "XAUUSD"), filename: file.name, text, utcOffsetHours: Number(fd.get("utcOffsetHours") ?? 0) || 0, timeframe: String(fd.get("timeframe") ?? "AUTO") });
  if (!r.ok) return err(r.error);
  revalidatePath("/lab/data");
  return { ok: true, message: `Dataset saved.${r.warnings.length ? " " + r.warnings.join(" ") : ""}` };
}

export async function createSyntheticDatasetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const r = await createSyntheticDataset(user.id, { symbol: String(fd.get("symbol") ?? "XAUUSD"), timeframe: String(fd.get("timeframe") ?? "H1"), days: Number(fd.get("days") ?? 200) });
  if (!r.ok) return err(r.error);
  revalidatePath("/lab/data");
  return { ok: true, message: "Synthetic demo dataset created. Remember: it is not real market data." };
}

export async function deleteDatasetAction(fd: FormData) {
  const user = await getUser();
  await prisma.dataset.deleteMany({ where: { id: String(fd.get("id")), userId: user.id } });
  revalidatePath("/lab/data");
}

const n = (fd: FormData, k: string, d?: number) => { const v = fd.get(k); return v === null || v === "" ? d : Number(v); };

function runInput(fd: FormData): RunInput | string {
  const params: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("param_") && String(v).trim() !== "") params[k.slice(6)] = Number(v);
  const spec = { contractSize: n(fd, "contractSize"), tickSize: n(fd, "tickSize"), tickValue: n(fd, "tickValue"), minLot: n(fd, "minLot"), maxLot: n(fd, "maxLot"), lotStep: n(fd, "lotStep") };
  const nums = [n(fd, "initialBalance"), n(fd, "riskPercent"), n(fd, "spread"), n(fd, "slippage"), n(fd, "commissionPerLot"), ...Object.values(spec), ...Object.values(params)];
  if (nums.some((x) => x !== undefined && !Number.isFinite(x))) return "One of the numbers isn't valid.";
  return {
    strategyId: String(fd.get("strategyId") ?? ""), datasetId: String(fd.get("datasetId") ?? ""), fromDate: String(fd.get("fromDate") ?? "") || undefined, toDate: String(fd.get("toDate") ?? "") || undefined,
    initialBalance: n(fd, "initialBalance", 10_000)!, riskPercent: n(fd, "riskPercent", 1)!, spread: n(fd, "spread", 0)!, slippage: n(fd, "slippage", 0)!, commissionPerLot: n(fd, "commissionPerLot", 0)!,
    pipSize: n(fd, "pipSize"), accountCurrency: String(fd.get("accountCurrency") ?? "USD"), fxRate: n(fd, "fxRate", 1),
    spec: Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== undefined)), params,
  };
}

export async function runBacktestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!rateLimit(`labrun:${user.id}`, 20, 60_000).ok) return err("Slow down — too many backtests in a minute.");
  const i = runInput(fd);
  if (typeof i === "string") return err(i);
  const r = await runAndSaveBacktest(user.id, i, String(fd.get("label") ?? ""));
  if (!r.ok) return err(r.error);
  revalidatePath("/lab");
  redirect(`/lab/runs/${r.id}`);
}

export async function runOptimizationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!rateLimit(`labrun:${user.id}`, 10, 60_000).ok) return err("Slow down — too many runs in a minute.");
  const i = runInput(fd);
  if (typeof i === "string") return err(i);
  const grid = [];
  try {
    for (const [k, v] of fd.entries()) if (k.startsWith("grid_")) grid.push({ name: k.slice(5), values: parseValues(String(v)) });
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid values"); }
  const r = await runAndSaveOptimization(user.id, i, grid);
  if (!r.ok) return err(r.error);
  revalidatePath("/lab");
  redirect(`/lab/runs/${r.id}`);
}

export async function runWalkForwardAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!rateLimit(`labrun:${user.id}`, 10, 60_000).ok) return err("Slow down — too many runs in a minute.");
  const i = runInput(fd);
  if (typeof i === "string") return err(i);
  const r = await runAndSaveWalkForward(user.id, i, String(fd.get("splitDate") ?? ""));
  if (!r.ok) return err(r.error);
  revalidatePath("/lab");
  redirect(`/lab/walkforward/${r.groupId}`);
}

export async function importTvAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return err("Choose the CSV exported from TradingView's Strategy Tester.");
  const r = await importTradingViewResults(user.id, {
    strategyId: String(fd.get("strategyId") ?? "") || undefined, name: String(fd.get("name") ?? ""), text: await file.text(), initialBalance: n(fd, "initialBalance", 10_000)!,
    assumedRiskPercent: n(fd, "assumedRiskPercent", 1)!, utcOffsetHours: n(fd, "utcOffsetHours", 0)!, symbol: String(fd.get("symbol") ?? "XAUUSD").toUpperCase(), timeframe: String(fd.get("timeframe") ?? "H1"),
  });
  if (!r.ok) return err(r.error);
  revalidatePath("/lab");
  redirect(`/lab/runs/${r.id}`);
}

export async function deleteRunAction(fd: FormData) {
  const user = await getUser();
  await deleteRun(user.id, String(fd.get("id")));
  revalidatePath("/lab");
  redirect("/lab");
}
