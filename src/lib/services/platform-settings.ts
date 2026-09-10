import { prisma } from "@/lib/db";

const DEFAULTS: Record<string, string> = {
  "platform.supportEmail": "support@stayos.example",
  "platform.trialDurationDays": "14",
  "platform.defaultCurrency": "USD",
};

export async function getPlatformSettings() {
  const rows = await prisma.setting.findMany({ where: { hotelId: null } });
  const map = new Map(rows.map((r) => [r.key, r.value as string]));
  return Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, map.get(key) ?? DEFAULTS[key]]));
}

// Setting.hotelId is nullable (shared column with per-hotel settings), and a
// unique index on (hotelId, key) does not enforce uniqueness across NULLs in
// Postgres -- so platform-level rows are read/written by explicit
// find-then-write rather than relying on upsert's ON CONFLICT behavior.
export async function updatePlatformSetting(key: string, value: string) {
  if (!(key in DEFAULTS)) throw new Error("Unknown setting");
  const existing = await prisma.setting.findFirst({ where: { hotelId: null, key } });
  if (existing) {
    await prisma.setting.update({ where: { id: existing.id }, data: { value: value as never } });
  } else {
    await prisma.setting.create({ data: { hotelId: null, key, value: value as never } });
  }
}
