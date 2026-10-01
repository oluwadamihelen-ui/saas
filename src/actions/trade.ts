"use server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getContext, getOwnedAccount } from "@/lib/session";
import { fieldErrors, tradeSchema, type ActionState } from "@/lib/validation";
import { calculateRMultiple } from "@/lib/engine/risk";
import { currentBalance, refreshDailyRisk } from "@/lib/data";
import { MAX_UPLOAD_BYTES, getStorage, sniffImage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

type Parsed = NonNullable<ReturnType<typeof tradeSchema.safeParse>["data"]>;

function resultFromPnl(pnl: number | null) {
  if (pnl === null) return "OPEN" as const;
  return pnl > 0 ? ("WIN" as const) : pnl < 0 ? ("LOSS" as const) : ("BREAKEVEN" as const);
}

async function saveScreenshots(userId: string, tradeId: string, files: File[]): Promise<string | null> {
  const storage = getStorage();
  const existing = await prisma.tradeScreenshot.count({ where: { tradeId, userId } });
  if (existing + files.length > 6) return "You can attach up to 6 screenshots per trade.";
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return `${f.name} is larger than 5 MB.`;
    const buf = Buffer.from(await f.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) return `${f.name} is not a PNG, JPEG or WebP image.`;
    const key = `${userId}/${tradeId}/${randomUUID()}.${kind.ext}`;
    await storage.put(key, buf, kind.mime);
    await prisma.tradeScreenshot.create({ data: { userId, tradeId, storageKey: key, mimeType: kind.mime, sizeBytes: buf.length } });
  }
  return null;
}

function tagConnect(userId: string, tags: string[]) {
  return tags.map((name) => ({ where: { userId_name: { userId, name } }, create: { userId, name } }));
}

function body(d: Parsed, balanceBefore: number) {
  const pnl = d.pnl;
  return {
    openedAt: d.openedAt,
    instrument: d.instrument,
    direction: d.direction,
    entryPrice: d.entryPrice,
    stopLoss: d.stopLoss,
    takeProfit: d.takeProfit,
    exitPrice: d.exitPrice,
    lots: d.lots,
    riskAmount: d.riskAmount,
    riskPercent: balanceBefore > 0 ? (d.riskAmount / balanceBefore) * 100 : 0,
    result: resultFromPnl(pnl),
    pnl,
    rMultiple: pnl === null ? null : calculateRMultiple(pnl, d.riskAmount),
    setup: d.setup, session: d.session, reasonEntry: d.reasonEntry, reasonExit: d.reasonExit,
    emotionBefore: d.emotionBefore, emotionAfter: d.emotionAfter, notes: d.notes, checklistScore: d.checklistScore,
  };
}

export async function createTradeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, plan } = await getContext();
  if (!rateLimit(`trade:${user.id}`, 40, 60_000).ok) return { error: "Too many requests. Slow down a little." };
  const account = await getOwnedAccount(user.id, String(fd.get("accountId") ?? ""));
  if (!account || account.archivedAt) return { error: "Account not found." };

  const total = await prisma.trade.count({ where: { userId: user.id } });
  if (total >= plan.limits.maxTrades) return { error: `The Free plan stores up to ${plan.limits.maxTrades} trades. Upgrade to Pro for unlimited trades.` };

  const parsed = tradeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const files = fd.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length && !plan.limits.screenshots) return { error: "Screenshot storage is a Pro feature." };

  const before = await prisma.trade.findMany({ where: { userId: user.id, accountId: account.id, openedAt: { lt: parsed.data.openedAt } }, select: { pnl: true } });
  const balanceBefore = currentBalance(account.startingBalance, before);

  const trade = await prisma.trade.create({
    data: { ...body(parsed.data, balanceBefore), userId: user.id, accountId: account.id, tags: { connectOrCreate: tagConnect(user.id, parsed.data.tags) } },
  });
  const upErr = files.length ? await saveScreenshots(user.id, trade.id, files) : null;
  await refreshDailyRisk(user.id, account.id, [trade.openedAt], user.timezone, account.riskSettings!.maxDailyLossPercent, account.startingBalance);
  revalidatePath("/", "layout");
  redirect(`/journal/${trade.id}${upErr ? `?notice=${encodeURIComponent(upErr)}` : ""}`);
}

export async function updateTradeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, plan } = await getContext();
  const id = String(fd.get("id") ?? "");
  const existing = await prisma.trade.findFirst({ where: { id, userId: user.id }, include: { account: { include: { riskSettings: true } } } });
  if (!existing) return { error: "Trade not found." };

  const parsed = tradeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const files = fd.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length && !plan.limits.screenshots) return { error: "Screenshot storage is a Pro feature." };

  const before = await prisma.trade.findMany({ where: { userId: user.id, accountId: existing.accountId, openedAt: { lt: parsed.data.openedAt }, id: { not: id } }, select: { pnl: true } });
  const balanceBefore = currentBalance(existing.account.startingBalance, before);

  await prisma.trade.update({
    where: { id },
    data: { ...body(parsed.data, balanceBefore), tags: { set: [], connectOrCreate: tagConnect(user.id, parsed.data.tags) } },
  });
  const upErr = files.length ? await saveScreenshots(user.id, id, files) : null;
  await refreshDailyRisk(user.id, existing.accountId, [existing.openedAt, parsed.data.openedAt], user.timezone, existing.account.riskSettings!.maxDailyLossPercent, existing.account.startingBalance);
  revalidatePath("/", "layout");
  redirect(`/journal/${id}${upErr ? `?notice=${encodeURIComponent(upErr)}` : ""}`);
}

export async function deleteTradeAction(fd: FormData) {
  const { user } = await getContext();
  const id = String(fd.get("id") ?? "");
  const t = await prisma.trade.findFirst({ where: { id, userId: user.id }, include: { screenshots: true, account: { include: { riskSettings: true } } } });
  if (!t) redirect("/journal");
  const storage = getStorage();
  for (const s of t.screenshots) await storage.delete(s.storageKey).catch(() => {});
  await prisma.trade.delete({ where: { id: t.id } });
  await refreshDailyRisk(user.id, t.accountId, [t.openedAt], user.timezone, t.account.riskSettings!.maxDailyLossPercent, t.account.startingBalance);
  revalidatePath("/", "layout");
  redirect("/journal");
}

export async function deleteScreenshotAction(fd: FormData) {
  const { user } = await getContext();
  const id = String(fd.get("id") ?? "");
  const s = await prisma.tradeScreenshot.findFirst({ where: { id, userId: user.id } });
  if (!s) return;
  await getStorage().delete(s.storageKey).catch(() => {});
  await prisma.tradeScreenshot.delete({ where: { id: s.id } });
  revalidatePath(`/journal/${s.tradeId}`);
}
