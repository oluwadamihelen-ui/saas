export type PricingModel = "FREE" | "ONE_TIME" | "MONTHLY" | "YEARLY";

export const usdShort = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

export function priceLabel(model: PricingModel, cents: number): string {
  if (model === "FREE") return "Free";
  const p = usdShort(cents);
  return model === "ONE_TIME" ? `${p} one-time` : model === "MONTHLY" ? `${p}/month` : `${p}/year`;
}

export const ngnShort = (cents: number, rate: number) => `₦${Math.round((cents / 100) * rate).toLocaleString("en-NG")}`;

export const STATUS_TONE: Record<string, "neutral" | "up" | "warn" | "down" | "accent"> = { DRAFT: "neutral", PENDING_REVIEW: "warn", APPROVED: "up", REJECTED: "down", SUSPENDED: "down" };
export const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_REVIEW: "Pending review", APPROVED: "Approved", REJECTED: "Rejected", SUSPENDED: "Suspended" };
