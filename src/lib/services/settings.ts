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

interface DeveloperSettings {
  commissionRate?: number;
}

const DEFAULT_DEVELOPER_COMMISSION_RATE = 0.7;

/**
 * Share of a direct application-license sale paid out to the developer who
 * authored it (Application.createdBy with role DEVELOPER). Platform-wide
 * rather than per-application to keep this simple -- same shape as
 * getPlatformCurrency.
 */
export async function getDeveloperCommissionRate(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: "developer" } });
  const value = setting?.value as DeveloperSettings | undefined;
  return value?.commissionRate ?? DEFAULT_DEVELOPER_COMMISSION_RATE;
}
