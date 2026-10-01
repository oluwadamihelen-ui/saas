"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUser, getPlan, getContext } from "@/lib/session";
import { accountSchema, rulesSchema, fieldErrors, type ActionState } from "@/lib/validation";
import { cleanText } from "@/lib/sanitize";
import { DEFAULT_CHECKLIST } from "@/lib/engine/guardrail";

function accountInput(fd: FormData) {
  const instruments = String(fd.get("instruments") ?? "").split(/[\s,]+/).map((s) => s.toUpperCase().trim()).filter(Boolean);
  return accountSchema.safeParse({
    name: fd.get("name"), currency: fd.get("currency"), startingBalance: fd.get("startingBalance"),
    broker: fd.get("broker") ?? "", platform: fd.get("platform") ?? "MT5", instruments,
  });
}

function rulesInput(fd: FormData) {
  return rulesSchema.safeParse(Object.fromEntries(fd));
}

/** Creates an account + its risk settings. Used by onboarding and the Accounts page. */
async function createAccount(userId: string, a: NonNullable<ReturnType<typeof accountInput>["data"]>, r: NonNullable<ReturnType<typeof rulesInput>["data"]>) {
  const account = await prisma.account.create({
    data: { userId, name: a.name, currency: a.currency, startingBalance: a.startingBalance, broker: a.broker, platform: a.platform, instruments: a.instruments, riskSettings: { create: r } },
  });
  return account;
}

export async function onboardingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const a = accountInput(fd);
  const r = rulesInput(fd);
  if (!a.success) return { fields: fieldErrors(a.error) };
  if (!r.success) return { fields: fieldErrors(r.error) };
  const existing = await prisma.account.count({ where: { userId: user.id } });
  if (existing > 0) return { ok: true };
  const account = await createAccount(user.id, a.data, r.data);
  await prisma.user.update({ where: { id: user.id }, data: { onboardedAt: new Date(), activeAccountId: account.id, displayCurrency: a.data.currency } });
  await prisma.checklist.upsert({ where: { userId: user.id }, create: { userId: user.id, items: DEFAULT_CHECKLIST }, update: {} });
  return { ok: true };
}

export async function createAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const plan = await getPlan(user.id);
  const count = await prisma.account.count({ where: { userId: user.id, archivedAt: null } });
  if (count >= plan.limits.maxAccounts) return { error: "Your plan's account limit is reached. Upgrade to Pro for multiple accounts." };
  const a = accountInput(fd);
  if (!a.success) return { fields: fieldErrors(a.error) };
  const rs = rulesSchema.parse({ defaultRiskPercent: 1, maxRiskPerTrade: 1, maxDailyLossPercent: 3, maxWeeklyLossPercent: 6, maxTradesPerDay: 5, minRiskReward: 1.5, lowMax: 1, moderateMax: 2, highMax: 5 });
  const account = await createAccount(user.id, a.data, rs);
  await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: account.id } });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, account } = await getContext();
  const a = accountInput(fd);
  if (!a.success) return { fields: fieldErrors(a.error) };
  const id = String(fd.get("id") ?? account.id);
  const res = await prisma.account.updateMany({ where: { id, userId: user.id }, data: { name: a.data.name, currency: a.data.currency, startingBalance: a.data.startingBalance, broker: a.data.broker, platform: a.data.platform, instruments: a.data.instruments } });
  if (!res.count) return { error: "Account not found." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function setActiveAccountAction(accountId: string) {
  const user = await getUser();
  const owned = await prisma.account.findFirst({ where: { id: accountId, userId: user.id, archivedAt: null }, select: { id: true } });
  if (!owned) return;
  await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: owned.id } });
  revalidatePath("/", "layout");
}

export async function archiveAccountAction(accountId: string) {
  const { user, accounts } = await getContext();
  if (accounts.length <= 1) return;
  await prisma.account.updateMany({ where: { id: accountId, userId: user.id }, data: { archivedAt: new Date() } });
  if (user.activeAccountId === accountId) {
    const next = accounts.find((a) => a.id !== accountId);
    await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: next?.id } });
  }
  revalidatePath("/", "layout");
}

export async function updateRulesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, account, plan } = await getContext();
  const r = rulesInput(fd);
  if (!r.success) return { fields: fieldErrors(r.error) };
  let data = r.data;
  if (!plan.limits.advancedRules) {
    // Free plan: only the basics are editable; advanced fields keep their stored values.
    const cur = account.riskSettings;
    data = { ...data, maxWeeklyLossPercent: cur.maxWeeklyLossPercent, minRiskReward: cur.minRiskReward, lowMax: cur.lowMax, moderateMax: cur.moderateMax, highMax: cur.highMax, maxTotalDrawdownPercent: cur.maxTotalDrawdownPercent, drawdownType: cur.drawdownType === "TRAILING" ? "TRAILING" : "STATIC", profitTargetPercent: cur.profitTargetPercent, ruleTemplate: cur.ruleTemplate };
  }
  await prisma.riskSettings.updateMany({ where: { accountId: account.id, account: { userId: user.id } }, data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Rules saved." };
}

export async function updateChecklistAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const items = String(fd.get("items") ?? "").split("\n").map((s) => cleanText(s, 120)).filter(Boolean).slice(0, 15);
  if (!items.length) return { error: "Add at least one checklist item." };
  await prisma.checklist.upsert({ where: { userId: user.id }, create: { userId: user.id, items }, update: { items } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Checklist saved." };
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  const name = cleanText(fd.get("name"), 80);
  const tz = String(fd.get("timezone") ?? "Africa/Lagos");
  const display = String(fd.get("displayCurrency") ?? "USD");
  if (!["Africa/Lagos", "UTC", "Europe/London", "America/New_York", "Asia/Dubai", "Africa/Johannesburg", "Africa/Nairobi", "Africa/Accra"].includes(tz)) return { error: "Unsupported timezone." };
  if (!["USD", "NGN", "EUR", "GBP"].includes(display)) return { error: "Unsupported currency." };
  await prisma.user.update({ where: { id: user.id }, data: { name: name || null, timezone: tz, displayCurrency: display } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

// ------------------------------------------------------------- Telegram

import { generateLinkCode, LINK_CODE_TTL_MS } from "@/lib/notifications/telegram";

export async function generateTelegramCodeAction(): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const user = await getUser();
  if (!process.env.TELEGRAM_BOT_TOKEN) return { error: "Telegram isn't set up on this server yet." };
  for (let i = 0; i < 5; i++) {
    const code = generateLinkCode();
    const expires = new Date(Date.now() + LINK_CODE_TTL_MS);
    try {
      await prisma.user.update({ where: { id: user.id }, data: { telegramLinkCode: code, telegramLinkExpires: expires } });
      return { code, expiresAt: expires.toISOString() };
    } catch {
      // unique collision — try another code
    }
  }
  return { error: "Could not create a code. Try again." };
}

export async function disconnectTelegramAction() {
  const user = await getUser();
  await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null, telegramLinkCode: null, telegramLinkExpires: null } });
  revalidatePath("/settings");
}

export async function updateNotifyPrefsAction(fd: FormData) {
  const user = await getUser();
  await prisma.user.update({ where: { id: user.id }, data: { notifyLimits: fd.get("notifyLimits") === "on", notifyReminders: fd.get("notifyReminders") === "on" } });
  revalidatePath("/settings");
}

/** Whether a Telegram link has completed (polled by the settings page while a code is shown). */
export async function telegramStatusAction(): Promise<{ linked: boolean }> {
  const user = await getUser();
  return { linked: !!user.telegramChatId };
}
