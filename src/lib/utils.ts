import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY_SYMBOL } from "@/lib/engine/instruments";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export function money(v: number | null | undefined, currency = "USD", opts: { sign?: boolean; decimals?: number } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const sym = CURRENCY_SYMBOL[currency] ?? currency + " ";
  const d = opts.decimals ?? (Math.abs(v) >= 1000 ? 0 : 2);
  const body = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sign = v < 0 ? "-" : opts.sign && v > 0 ? "+" : "";
  return `${sign}${sym}${body}`;
}

export const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);
export const rFmt = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`);

export function fmtDate(d: Date | string, tz = "Africa/Lagos", withTime = false) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}) }).format(new Date(d));
}

/** Format a price without trailing-zero noise but keep enough precision for FX. */
export function price(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const d = Math.abs(v) < 10 ? 5 : Math.abs(v) < 1000 ? 3 : 2;
  return v.toFixed(d).replace(/\.?0+$/, "");
}
