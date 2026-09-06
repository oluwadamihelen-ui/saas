import { prisma } from "@/lib/db";

interface GeneralSettings {
  companyName?: string;
  supportEmail?: string;
  currency?: string;
}

const DEFAULT_CURRENCY = "USD";

/**
 * Single source of truth for the platform's default currency. Admin-configurable
 * via Settings so new pricing/orders don't need the currency hard-coded
 * throughout the app -- existing records keep whatever currency they were
 * created with (see Order/OrderItem "historical price" snapshotting).
 */
export async function getPlatformCurrency(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "general" } });
  const value = setting?.value as GeneralSettings | undefined;
  return value?.currency || DEFAULT_CURRENCY;
}
