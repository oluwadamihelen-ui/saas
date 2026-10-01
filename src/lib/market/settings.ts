import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS, mergeSettings, settingsSchema, type MarketSettings } from "./settings-defaults";
import { assertAdmin, audit, type Actor } from "./admin-core";

let cache: { at: number; value: MarketSettings } | null = null;

export async function getMarketSettings(): Promise<MarketSettings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const rows = await prisma.platformSetting.findMany();
  const stored: Record<string, unknown> = {};
  for (const r of rows) stored[r.key] = r.value;
  const value = mergeSettings(stored);
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}

/** Admin only. Validates the full settings object before storing anything. */
export async function saveMarketSettings(actor: Actor, patch: Partial<MarketSettings>): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(actor);
  const current = await getMarketSettings();
  const next = { ...current, ...patch, priceLimits: { ...current.priceLimits, ...(patch.priceLimits ?? {}) } };
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  for (const [key, value] of Object.entries(parsed.data)) {
    await prisma.platformSetting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
  }
  invalidateSettingsCache();
  await audit(actor, "SETTINGS_UPDATE", "settings", "market", { changed: Object.keys(patch) });
  return { ok: true };
}

export { DEFAULT_SETTINGS };
