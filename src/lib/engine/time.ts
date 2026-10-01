/** Timezone helpers. Default zone is Africa/Lagos (UTC+1, no DST). */
export const DEFAULT_TZ = "Africa/Lagos";

function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return o;
}

/** YYYY-MM-DD in `tz`. */
export function dayKey(date: Date, tz = DEFAULT_TZ): string {
  const p = parts(date, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

export function monthKey(date: Date, tz = DEFAULT_TZ): string {
  return dayKey(date, tz).slice(0, 7);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayName(date: Date, tz = DEFAULT_TZ): string {
  return parts(date, tz).weekday ?? DOW[date.getUTCDay()];
}

export function hourIn(date: Date, tz = DEFAULT_TZ): number {
  return Number(parts(date, tz).hour);
}

/** Monday of the week containing `date`, as YYYY-MM-DD in tz. */
export function weekStartKey(date: Date, tz = DEFAULT_TZ): string {
  const k = dayKey(date, tz);
  const idx = WEEKDAYS.indexOf(weekdayName(date, tz));
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - idx);
  return d.toISOString().slice(0, 10);
}

/** Informal market-session label from the UTC hour (a journaling aid, not a market-hours claim). */
export function sessionFor(date: Date): "Asia" | "London" | "New York" | "Off-hours" {
  const h = date.getUTCHours();
  if (h >= 13 && h < 21) return "New York";
  if (h >= 7 && h < 13) return "London";
  if (h >= 0 && h < 7) return "Asia";
  return "Off-hours";
}

export const SESSIONS = ["Asia", "London", "New York", "Off-hours"] as const;
