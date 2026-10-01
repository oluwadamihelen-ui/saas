/** Who may access what. Pure rules; the DB layer feeds them. */
export type LicenseType = "FREE" | "ONE_TIME" | "MONTHLY" | "YEARLY";
export type LicenseStatus = "ACTIVE" | "EXPIRED" | "REFUNDED" | "REVOKED";
export type UpdatePolicy = "ALL_UPDATES" | "SAME_MAJOR" | "NO_UPDATES";

export interface LicenseLike {
  status: LicenseStatus;
  type: LicenseType;
  startedAt: Date;
  currentPeriodEnd: Date | null;
  maxMajor: number;
}

export const majorOf = (version: string): number => {
  const m = version.trim().replace(/^v/i, "").match(/^(\d+)/);
  return m ? Number(m[1]) : 0;
};

/** Is the license currently valid? Refunded/revoked never are; subscriptions lapse at period end. */
export function isLicenseActive(l: LicenseLike, now: Date): boolean {
  if (l.status === "REFUNDED" || l.status === "REVOKED" || l.status === "EXPIRED") return false;
  if (l.type === "MONTHLY" || l.type === "YEARLY") return !!l.currentPeriodEnd && now.getTime() < l.currentPeriodEnd.getTime();
  return true;
}

/**
 * Which versions may this license receive?
 *  • Subscriptions (while active): every released version.
 *  • Free / one-time follow the product's update policy:
 *      ALL_UPDATES → every version; SAME_MAJOR → versions up to the major owned at purchase;
 *      NO_UPDATES → only versions released on or before the purchase.
 */
export function canAccessVersion(l: LicenseLike, policy: UpdatePolicy, version: { version: string; releasedAt: Date }, now: Date): boolean {
  if (!isLicenseActive(l, now)) return false;
  if (version.releasedAt.getTime() > now.getTime()) return false; // unreleased
  if (l.type === "MONTHLY" || l.type === "YEARLY") return true;
  if (policy === "ALL_UPDATES") return true;
  if (policy === "SAME_MAJOR") return majorOf(version.version) <= l.maxMajor;
  return version.releasedAt.getTime() <= l.startedAt.getTime();
}

export const PERIOD_DAYS: Record<"MONTHLY" | "YEARLY", number> = { MONTHLY: 31, YEARLY: 366 };

/** New period end when buying/renewing: extend from the current end if still running, else from now. */
export function nextPeriodEnd(type: "MONTHLY" | "YEARLY", currentEnd: Date | null, now: Date): Date {
  const start = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return new Date(start.getTime() + PERIOD_DAYS[type] * 86_400_000);
}

/** Can this user leave a review? Never the creator; never after a refund/revocation. */
export function canReview(args: { userId: string; creatorUserId: string; license: Pick<LicenseLike, "status"> | null }): { ok: boolean; reason?: string } {
  if (args.userId === args.creatorUserId) return { ok: false, reason: "Creators can't review their own products." };
  if (!args.license) return { ok: false, reason: "Only people who have access to this product can review it." };
  if (args.license.status === "REFUNDED" || args.license.status === "REVOKED") return { ok: false, reason: "Your access to this product ended, so you can't review it." };
  return { ok: true };
}

export function validatePrice(model: "FREE" | "ONE_TIME" | "MONTHLY" | "YEARLY", cents: number, limits: Record<"ONE_TIME" | "MONTHLY" | "YEARLY", { minCents: number; maxCents: number }>): string | null {
  if (model === "FREE") return cents === 0 ? null : "Free products must have a price of $0.";
  if (!Number.isInteger(cents) || cents <= 0) return "Enter a price above zero.";
  const l = limits[model];
  if (cents < l.minCents || cents > l.maxCents) return `Price must be between $${(l.minCents / 100).toFixed(2)} and $${(l.maxCents / 100).toFixed(2)} for this pricing model.`;
  return null;
}
