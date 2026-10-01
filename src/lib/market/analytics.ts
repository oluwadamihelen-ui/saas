/** Pure revenue bucketing for the creator dashboard. */
export type Granularity = "day" | "week" | "month";

export interface RevenuePoint { label: string; cents: number }

function keyOf(d: Date, g: Granularity): string {
  if (g === "month") return d.toISOString().slice(0, 7);
  if (g === "day") return d.toISOString().slice(0, 10);
  // ISO week start (Monday), UTC
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/** Last `count` buckets ending at `now`, including empty ones, oldest first. Refund entries (negative) net off. */
export function bucketRevenue(entries: { amountUsdCents: number; createdAt: Date }[], g: Granularity, count: number, now: Date): RevenuePoint[] {
  const labels: string[] = [];
  const cursor = new Date(now);
  for (let i = 0; i < count; i++) {
    labels.unshift(keyOf(cursor, g));
    if (g === "day") cursor.setUTCDate(cursor.getUTCDate() - 1);
    else if (g === "week") cursor.setUTCDate(cursor.getUTCDate() - 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() - 1, 1);
  }
  const sums = new Map(labels.map((l) => [l, 0]));
  for (const e of entries) {
    const k = keyOf(e.createdAt, g);
    if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + e.amountUsdCents);
  }
  return labels.map((label) => ({ label, cents: sums.get(label) ?? 0 }));
}

export const ratio = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
